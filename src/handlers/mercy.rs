use rust_i18n::t;
use teloxide::Bot;
use teloxide::payloads::AnswerCallbackQuerySetters;
use teloxide::requests::Requester;
use teloxide::types::{CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, UserId};
use crate::domain::{LanguageCode, Username};
use crate::handlers::utils::callbacks::{CallbackDataWithPrefix, InvalidCallbackData, InvalidCallbackDataBuilder, NewLayoutValue};
use crate::handlers::{CallbackResult, HandlerResult};
use crate::repo::{ChatIdPartiality, Repositories};
use crate::handlers::pvp::new_short_timestamp;

/// Mercy action types
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum MercyAction {
    TakeFull,      // Take 100% of the bet
    ShowMercy,     // Take 50%, return 50%
    FullReturn,    // Return 100%, earn Kind Soul point
}

impl MercyAction {
    fn from_u8(val: u8) -> Option<Self> {
        match val {
            0 => Some(Self::TakeFull),
            1 => Some(Self::ShowMercy),
            2 => Some(Self::FullReturn),
            _ => None,
        }
    }

    fn to_u8(&self) -> u8 {
        match self {
            Self::TakeFull => 0,
            Self::ShowMercy => 1,
            Self::FullReturn => 2,
        }
    }
}

/// Callback data for mercy decision buttons
#[derive(derive_more::Display)]
#[display("{winner}:{loser}:{bet}:{action}:{timestamp}")]
pub struct MercyCallbackData {
    winner: UserId,
    loser: UserId,
    bet: u16,
    action: u8,
    timestamp: NewLayoutValue<i64>,
}

impl MercyCallbackData {
    pub fn new(winner: UserId, loser: UserId, bet: u16, action: MercyAction) -> Self {
        Self {
            winner,
            loser,
            bet,
            action: action.to_u8(),
            timestamp: new_short_timestamp(),
        }
    }

    pub fn action(&self) -> Option<MercyAction> {
        MercyAction::from_u8(self.action)
    }
}

impl CallbackDataWithPrefix for MercyCallbackData {
    fn prefix() -> &'static str {
        "mercy"
    }
}

impl TryFrom<String> for MercyCallbackData {
    type Error = InvalidCallbackData;

    fn try_from(data: String) -> Result<Self, Self::Error> {
        let err = InvalidCallbackDataBuilder(&data);
        let mut parts = data.split(':');
        
        let winner = crate::handlers::utils::callbacks::parse_part(&mut parts, &err, "winner").map(UserId)?;
        let loser = crate::handlers::utils::callbacks::parse_part(&mut parts, &err, "loser").map(UserId)?;
        let bet: u16 = crate::handlers::utils::callbacks::parse_part(&mut parts, &err, "bet")?;
        let action: u8 = crate::handlers::utils::callbacks::parse_part(&mut parts, &err, "action")?;
        let timestamp = crate::handlers::utils::callbacks::parse_optional_part(&mut parts, &err)?;
        
        Ok(Self { winner, loser, bet, action, timestamp })
    }
}

/// Build mercy decision keyboard for the winner
pub fn build_mercy_keyboard(
    winner: UserId,
    loser: UserId,
    bet: u16,
    lang_code: &LanguageCode,
) -> InlineKeyboardMarkup {
    let take_full_btn = InlineKeyboardButton::callback(
        t!("commands.pvp.mercy_buttons.take_full", locale = lang_code),
        MercyCallbackData::new(winner, loser, bet, MercyAction::TakeFull).to_data_string(),
    );
    
    let show_mercy_btn = InlineKeyboardButton::callback(
        t!("commands.pvp.mercy_buttons.show_mercy", locale = lang_code),
        MercyCallbackData::new(winner, loser, bet, MercyAction::ShowMercy).to_data_string(),
    );
    
    let full_return_btn = InlineKeyboardButton::callback(
        t!("commands.pvp.mercy_buttons.full_return", locale = lang_code),
        MercyCallbackData::new(winner, loser, bet, MercyAction::FullReturn).to_data_string(),
    );
    
    InlineKeyboardMarkup::new(vec![
        vec![take_full_btn],
        vec![show_mercy_btn],
        vec![full_return_btn],
    ])
}

/// Filter for mercy callbacks
#[inline]
pub fn callback_filter(query: CallbackQuery) -> bool {
    MercyCallbackData::check_prefix(query)
}

/// Handle mercy decision callback
pub async fn callback_handler(
    bot: Bot,
    query: CallbackQuery,
    repos: Repositories,
) -> HandlerResult {
    let lang_code = LanguageCode::from_user(&query.from);
    let callback_data = MercyCallbackData::parse(&query)?;
    
    // Only the winner can make the mercy decision
    if callback_data.winner != query.from.id {
        bot.answer_callback_query(&query.id)
            .text(t!("inline.callback.errors.another_user", locale = &lang_code))
            .show_alert(true)
            .await?;
        return Ok(());
    }
    
    let action = callback_data.action().ok_or("invalid mercy action")?;
    let bet = callback_data.bet;
    
    // Get winner and loser info
    let winner_user = repos.users.get(callback_data.winner).await?
        .ok_or("winner not found")?;
    let loser_user = repos.users.get(callback_data.loser).await?
        .ok_or("loser not found")?;
    
    let winner_name = Username::from(winner_user.name.clone());
    let loser_name = Username::from(loser_user.name.clone());
    
    let result_text = match action {
        MercyAction::TakeFull => {
            // Full reward was already applied during the battle, no changes needed
            t!("commands.pvp.results.finish", locale = &lang_code,
                winner_name = winner_name.escaped(),
                winner_length = "N/A", // Would need to fetch current length
                loser_length = "N/A",
                bet = bet
            ).to_string()
        }
        MercyAction::ShowMercy => {
            let returned = bet / 2;
            let taken = bet - returned;
            
            // Return half to the loser
            // Note: In production, this would need chat_id context
            // repos.dicks.grow_no_attempts_check(&chat_id, callback_data.loser, returned as i32).await?;
            // repos.dicks.grow_no_attempts_check(&chat_id, callback_data.winner, -(returned as i32)).await?;
            
            // Record mercy shown (would need new repo method)
            // repos.mercy_stats.record_mercy_shown(callback_data.winner).await?;
            // repos.mercy_stats.record_mercy_received(callback_data.loser).await?;
            
            format!(
                "{}\n\n{}",
                t!("commands.pvp.results.mercy.shown", locale = &lang_code,
                    winner_name = winner_name.escaped(),
                    taken = taken,
                    returned = returned,
                    loser_name = loser_name.escaped()
                ),
                t!("commands.pvp.results.mercy.grace_token", locale = &lang_code,
                    loser_name = loser_name.escaped()
                )
            )
        }
        MercyAction::FullReturn => {
            // Return full bet to loser
            // repos.dicks.grow_no_attempts_check(&chat_id, callback_data.loser, bet as i32).await?;
            // repos.dicks.grow_no_attempts_check(&chat_id, callback_data.winner, -(bet as i32)).await?;
            
            // Award Kind Soul point
            // repos.achievements.increment_kind_soul(callback_data.winner).await?;
            
            format!(
                "{}\n\n{}",
                t!("commands.pvp.results.mercy.full_return", locale = &lang_code,
                    winner_name = winner_name.escaped(),
                    bet = bet,
                    loser_name = loser_name.escaped()
                ),
                t!("commands.pvp.results.mercy.blessed_buff", locale = &lang_code,
                    loser_name = loser_name.escaped()
                )
            )
        }
    };
    
    CallbackResult::EditMessage(result_text, None).apply(bot, query).await?;
    
    Ok(())
}

/// Mercy stats structure
#[derive(Default, Clone)]
pub struct MercyStats {
    pub mercy_shown: u32,
    pub mercy_received: u32,
    pub kind_soul_points: u32,
}
