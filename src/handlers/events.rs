use rust_i18n::t;
use teloxide::Bot;
use teloxide::macros::BotCommands;
use teloxide::types::Message;
use crate::domain::LanguageCode;
use crate::handlers::{reply_html, HandlerResult};
use crate::repo::Repositories;
use chrono::{DateTime, Utc, Datelike};

#[derive(BotCommands, Clone)]
#[command(rename_rule = "lowercase")]
pub enum EventCommands {
    #[command(description = "events")]
    Events,
    #[command(description = "events")]
    Event,
}

/// Monthly event definitions
#[derive(Clone, Debug)]
pub struct MonthlyEvent {
    pub month: u32,
    pub key: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub mechanic: EventMechanic,
}

#[derive(Clone, Debug)]
pub enum EventMechanic {
    /// Mercy bonuses are multiplied
    MercyMultiplier(f32),
    /// Gift sunbeams for shared XP
    GiftBonusXp,
    /// Global leaderboard across all chats
    GlobalLeaderboard,
    /// Double growth chance
    DoubleGrowthChance(f32),
    /// Cross-chat cooperative goal
    CrossChatGoal { target_chats: u32 },
    /// 2x growth, capped
    GrowthMultiplier { multiplier: f32, cap: u32 },
    /// High-risk duels with 3x wagers, mercy disabled
    HighRiskDuels { wager_multiplier: f32 },
    /// Exchange sprouts for permanent seeds
    HarvestExchange,
    /// Trivia-based growth
    TriviaGrowth,
    /// Cosmetic-only spooky frames
    CosmeticEvent,
    /// Mercy counts 5x toward achievements
    MercyAchievementBonus(u32),
    /// Daily login streak rewards
    LoginStreak,
}

/// All monthly events
pub const MONTHLY_EVENTS: &[MonthlyEvent] = &[
    MonthlyEvent { month: 1, key: "frost_festival", name: "Frost Festival", description: "Grows are smaller but mercy bonuses 3x", mechanic: EventMechanic::MercyMultiplier(3.0) },
    MonthlyEvent { month: 2, key: "heart_bloom", name: "Heart Bloom", description: "Gift sunbeams for shared XP", mechanic: EventMechanic::GiftBonusXp },
    MonthlyEvent { month: 3, key: "spring_rally", name: "Spring Rally", description: "Global leaderboard across all chats", mechanic: EventMechanic::GlobalLeaderboard },
    MonthlyEvent { month: 4, key: "rain_dance", name: "Rain Dance", description: "Every grow has a chance of downpour doubling", mechanic: EventMechanic::DoubleGrowthChance(0.25) },
    MonthlyEvent { month: 5, key: "pollinator_quest", name: "Pollinator Quest", description: "Visit 5 different chats", mechanic: EventMechanic::CrossChatGoal { target_chats: 5 } },
    MonthlyEvent { month: 6, key: "solstice_surge", name: "Solstice Surge", description: "48h of 2x growth, capped per player", mechanic: EventMechanic::GrowthMultiplier { multiplier: 2.0, cap: 50 } },
    MonthlyEvent { month: 7, key: "fire_garden", name: "Fire Garden", description: "High-risk duels with 3x wagers, mercy disabled", mechanic: EventMechanic::HighRiskDuels { wager_multiplier: 3.0 } },
    MonthlyEvent { month: 8, key: "harvest_moon", name: "Harvest Moon", description: "Exchange sprouts for permanent seeds", mechanic: EventMechanic::HarvestExchange },
    MonthlyEvent { month: 9, key: "wisdom_trials", name: "Wisdom Trials", description: "Trivia-based growth, no RNG", mechanic: EventMechanic::TriviaGrowth },
    MonthlyEvent { month: 10, key: "haunted_hollow", name: "Haunted Hollow", description: "Cosmetic-only spooky frames", mechanic: EventMechanic::CosmeticEvent },
    MonthlyEvent { month: 11, key: "gratitude_grove", name: "Gratitude Grove", description: "Mercy actions count 5x toward achievements", mechanic: EventMechanic::MercyAchievementBonus(5) },
    MonthlyEvent { month: 12, key: "winter_lights", name: "Winter Lights", description: "Daily login streak rewards", mechanic: EventMechanic::LoginStreak },
];

/// Get the current month's event
pub fn get_current_event() -> Option<&'static MonthlyEvent> {
    let now = Utc::now();
    let month = now.month();
    MONTHLY_EVENTS.iter().find(|e| e.month == month)
}

/// Get the next month's event
pub fn get_upcoming_event() -> Option<&'static MonthlyEvent> {
    let now = Utc::now();
    let next_month = if now.month() == 12 { 1 } else { now.month() + 1 };
    MONTHLY_EVENTS.iter().find(|e| e.month == next_month)
}

/// Handle /events command
pub async fn cmd_handler(
    bot: Bot,
    msg: Message,
    _repos: Repositories,
) -> HandlerResult {
    let user = msg.from.as_ref();
    let lang_code = LanguageCode::from_maybe_user(user);
    
    let mut text = String::new();
    
    // Show current event
    if let Some(current) = get_current_event() {
        let time_left = get_time_until_month_end();
        text.push_str(&format!(
            "{}\n\n",
            t!("commands.events.current", locale = &lang_code,
                name = current.name,
                description = current.description,
                time_left = time_left
            )
        ));
    }
    
    // Show upcoming event
    if let Some(upcoming) = get_upcoming_event() {
        let time_until = get_time_until_next_month();
        text.push_str(&format!(
            "{}",
            t!("commands.events.upcoming", locale = &lang_code,
                name = upcoming.name,
                time_until = time_until
            )
        ));
    }
    
    if text.is_empty() {
        text = "No events available.".to_string();
    }
    
    reply_html(bot, &msg, text).await?;
    Ok(())
}

/// Calculate time remaining until end of month
fn get_time_until_month_end() -> String {
    let now = Utc::now();
    let days_in_month = days_in_month(now.year(), now.month());
    let days_left = days_in_month - now.day();
    format!("{} days", days_left)
}

/// Calculate time until next month starts
fn get_time_until_next_month() -> String {
    let now = Utc::now();
    let days_in_month = days_in_month(now.year(), now.month());
    let days_left = days_in_month - now.day();
    format!("{} days", days_left)
}

/// Get days in a month
fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

/// Check if an event mechanic affects a specific action
pub fn get_event_modifier(action: &EventAction) -> Option<f32> {
    let current = get_current_event()?;
    
    match (&current.mechanic, action) {
        (EventMechanic::MercyMultiplier(mult), EventAction::ShowMercy) => Some(*mult),
        (EventMechanic::DoubleGrowthChance(chance), EventAction::Grow) => {
            if rand::random::<f32>() < *chance {
                Some(2.0)
            } else {
                None
            }
        }
        (EventMechanic::GrowthMultiplier { multiplier, .. }, EventAction::Grow) => Some(*multiplier),
        (EventMechanic::HighRiskDuels { wager_multiplier }, EventAction::Duel) => Some(*wager_multiplier),
        (EventMechanic::MercyAchievementBonus(mult), EventAction::MercyAchievement) => Some(*mult as f32),
        _ => None,
    }
}

/// Actions that can be modified by events
#[derive(Clone, Debug)]
pub enum EventAction {
    Grow,
    Duel,
    ShowMercy,
    MercyAchievement,
    Gift,
}
