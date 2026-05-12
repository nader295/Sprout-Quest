use rust_i18n::t;
use teloxide::Bot;
use teloxide::macros::BotCommands;
use teloxide::payloads::AnswerCallbackQuerySetters;
use teloxide::requests::Requester;
use teloxide::types::{CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message};
use crate::domain::LanguageCode;
use crate::handlers::utils::callbacks::{CallbackDataWithPrefix, InvalidCallbackData, InvalidCallbackDataBuilder};
use crate::handlers::{reply_html, CallbackResult, HandlerResult};
use crate::repo::Repositories;

#[derive(BotCommands, Clone)]
#[command(rename_rule = "lowercase")]
pub enum ShopCommands {
    #[command(description = "shop")]
    Shop,
}

/// Shop item definitions
#[derive(Clone, Debug)]
pub struct ShopItem {
    pub key: &'static str,
    pub price: u32,
    pub category: ItemCategory,
    pub max_owned: Option<u32>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ItemCategory {
    Consumable,
    Cosmetic,
    Upgrade,
    Bundle,
}

/// All available shop items
pub const SHOP_ITEMS: &[ShopItem] = &[
    ShopItem { key: "fertilizer", price: 100, category: ItemCategory::Consumable, max_owned: Some(10) },
    ShopItem { key: "watering_can", price: 150, category: ItemCategory::Consumable, max_owned: Some(5) },
    ShopItem { key: "phoenix_seed", price: 300, category: ItemCategory::Consumable, max_owned: Some(3) },
    ShopItem { key: "grace_token", price: 200, category: ItemCategory::Consumable, max_owned: Some(5) },
    ShopItem { key: "perk_slot", price: 500, category: ItemCategory::Upgrade, max_owned: Some(3) },
];

/// Callback data for shop actions
#[derive(derive_more::Display)]
#[display("{action}:{item_key}")]
pub struct ShopCallbackData {
    action: ShopAction,
    item_key: String,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ShopAction {
    View,
    Buy,
    Confirm,
    Gift,
}

impl ShopAction {
    fn from_str(s: &str) -> Option<Self> {
        match s {
            "view" => Some(Self::View),
            "buy" => Some(Self::Buy),
            "confirm" => Some(Self::Confirm),
            "gift" => Some(Self::Gift),
            _ => None,
        }
    }
    
    fn as_str(&self) -> &'static str {
        match self {
            Self::View => "view",
            Self::Buy => "buy",
            Self::Confirm => "confirm",
            Self::Gift => "gift",
        }
    }
}

impl std::fmt::Display for ShopAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl ShopCallbackData {
    pub fn new(action: ShopAction, item_key: &str) -> Self {
        Self {
            action,
            item_key: item_key.to_string(),
        }
    }
}

impl CallbackDataWithPrefix for ShopCallbackData {
    fn prefix() -> &'static str {
        "shop"
    }
}

impl TryFrom<String> for ShopCallbackData {
    type Error = InvalidCallbackData;

    fn try_from(data: String) -> Result<Self, Self::Error> {
        let err = InvalidCallbackDataBuilder(&data);
        let mut parts = data.split(':');
        
        let action_str: String = crate::handlers::utils::callbacks::parse_part(&mut parts, &err, "action")?;
        let action = ShopAction::from_str(&action_str).ok_or_else(|| err.split_err())?;
        let item_key: String = crate::handlers::utils::callbacks::parse_part(&mut parts, &err, "item_key")?;
        
        Ok(Self { action, item_key })
    }
}

/// Handle /shop command
pub async fn cmd_handler(
    bot: Bot,
    msg: Message,
    repos: Repositories,
) -> HandlerResult {
    let user = msg.from.as_ref().ok_or("no FROM field")?;
    let lang_code = LanguageCode::from_maybe_user(Some(user));
    
    // Get user's sunbeams balance
    let balance = get_user_balance(&repos, user.id.0 as i64).await?;
    
    let mut text = format!(
        "<b>{}</b>\n\n{}\n\n",
        t!("commands.shop.title", locale = &lang_code),
        t!("commands.shop.balance", locale = &lang_code, sunbeams = balance)
    );
    
    // Group items by category
    let mut current_category: Option<ItemCategory> = None;
    
    for item in SHOP_ITEMS {
        if current_category.as_ref() != Some(&item.category) {
            let cat_key = match item.category {
                ItemCategory::Consumable => "consumables",
                ItemCategory::Cosmetic => "cosmetics",
                ItemCategory::Upgrade => "upgrades",
                ItemCategory::Bundle => "bundles",
            };
            text.push_str(&format!("\n<b>{}:</b>\n", t!(&format!("commands.shop.categories.{}", cat_key), locale = &lang_code)));
            current_category = Some(item.category.clone());
        }
        
        let item_name = t!(&format!("commands.shop.items.{}", item.key), locale = &lang_code);
        text.push_str(&format!("  {} - {} sunbeams\n", item_name, item.price));
    }
    
    // Build keyboard with buy buttons
    let buttons: Vec<Vec<InlineKeyboardButton>> = SHOP_ITEMS
        .iter()
        .filter(|item| item.category == ItemCategory::Consumable)
        .map(|item| {
            vec![InlineKeyboardButton::callback(
                format!("{} ({} sunbeams)", t!("commands.shop.buy", locale = &lang_code), item.price),
                ShopCallbackData::new(ShopAction::Buy, item.key).to_data_string(),
            )]
        })
        .collect();
    
    let keyboard = InlineKeyboardMarkup::new(buttons);
    
    let mut answer = reply_html(bot, &msg, text);
    answer.reply_markup = Some(teloxide::types::ReplyMarkup::InlineKeyboard(keyboard));
    answer.await?;
    
    Ok(())
}

/// Filter for shop callbacks
#[inline]
pub fn callback_filter(query: CallbackQuery) -> bool {
    ShopCallbackData::check_prefix(query)
}

/// Handle shop callback queries
pub async fn callback_handler(
    bot: Bot,
    query: CallbackQuery,
    repos: Repositories,
) -> HandlerResult {
    let lang_code = LanguageCode::from_user(&query.from);
    let callback_data = ShopCallbackData::parse(&query)?;
    let user_id = query.from.id.0 as i64;
    
    match callback_data.action {
        ShopAction::Buy => {
            let item = SHOP_ITEMS.iter()
                .find(|i| i.key == callback_data.item_key)
                .ok_or("item not found")?;
            
            let balance = get_user_balance(&repos, user_id).await?;
            
            if balance < item.price {
                let needed = item.price - balance;
                bot.answer_callback_query(&query.id)
                    .text(t!("commands.shop.errors.insufficient_funds", locale = &lang_code, needed = needed))
                    .show_alert(true)
                    .await?;
                return Ok(());
            }
            
            // Show confirmation
            let item_name = t!(&format!("commands.shop.items.{}", item.key), locale = &lang_code);
            let text = t!("commands.shop.confirm", locale = &lang_code, item = item_name.to_string(), price = item.price);
            
            let keyboard = InlineKeyboardMarkup::new(vec![vec![
                InlineKeyboardButton::callback(
                    "Confirm",
                    ShopCallbackData::new(ShopAction::Confirm, item.key).to_data_string(),
                ),
            ]]);
            
            CallbackResult::EditMessage(text.to_string(), Some(keyboard)).apply(bot, query).await?;
        }
        ShopAction::Confirm => {
            let item = SHOP_ITEMS.iter()
                .find(|i| i.key == callback_data.item_key)
                .ok_or("item not found")?;
            
            // Process purchase (in production, this would be a transaction)
            // repos.shop.purchase(user_id, item.key, item.price).await?;
            
            let item_name = t!(&format!("commands.shop.items.{}", item.key), locale = &lang_code);
            let text = t!("commands.shop.success", locale = &lang_code, item = item_name.to_string());
            
            CallbackResult::EditMessage(text.to_string(), None).apply(bot, query).await?;
        }
        _ => {}
    }
    
    Ok(())
}

/// Get user's sunbeam balance
async fn get_user_balance(_repos: &Repositories, _user_id: i64) -> anyhow::Result<u32> {
    // In production, query the database
    Ok(500) // Default starter balance for demo
}
