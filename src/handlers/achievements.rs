use rust_i18n::t;
use teloxide::Bot;
use teloxide::macros::BotCommands;
use teloxide::types::Message;
use crate::domain::LanguageCode;
use crate::handlers::{reply_html, HandlerResult};
use crate::repo::Repositories;

#[derive(BotCommands, Clone)]
#[command(rename_rule = "lowercase")]
pub enum AchievementCommands {
    #[command(description = "achievements")]
    Achievements,
}

/// Achievement definitions with their targets
#[derive(Clone, Debug)]
pub struct AchievementDef {
    pub key: &'static str,
    pub target: u32,
}

/// All available achievements
pub const ACHIEVEMENTS: &[AchievementDef] = &[
    AchievementDef { key: "first_bloom", target: 1 },
    AchievementDef { key: "kind_soul_1", target: 10 },
    AchievementDef { key: "kind_soul_2", target: 50 },
    AchievementDef { key: "kind_soul_3", target: 200 },
    AchievementDef { key: "underdog", target: 1 },
    AchievementDef { key: "centenarian", target: 100 },
    AchievementDef { key: "mythical", target: 1 },
    AchievementDef { key: "traveler", target: 12 },
    AchievementDef { key: "generous", target: 25 },
    AchievementDef { key: "champion", target: 10 },
];

/// User's achievement progress
#[derive(Clone, Debug, Default)]
pub struct UserAchievement {
    pub key: String,
    pub progress: u32,
    pub target: u32,
    pub unlocked: bool,
}

impl UserAchievement {
    pub fn progress_text(&self) -> String {
        if self.unlocked {
            "Unlocked".to_string()
        } else {
            format!("{}/{}", self.progress, self.target)
        }
    }
}

/// Handle /achievements command
pub async fn cmd_handler(
    bot: Bot,
    msg: Message,
    repos: Repositories,
) -> HandlerResult {
    let user = msg.from.as_ref().ok_or("no FROM field")?;
    let lang_code = LanguageCode::from_maybe_user(Some(user));
    
    // Get user's achievement progress
    let achievements = get_user_achievements(&repos, user.id.0 as i64).await?;
    
    let mut text = format!("<b>{}</b>\n\n", t!("commands.achievements.title", locale = &lang_code));
    
    for achievement in achievements {
        let name_key = format!("commands.achievements.list.{}", achievement.key);
        let name = t!(&name_key, locale = &lang_code);
        
        let status = if achievement.unlocked {
            "".to_string()
        } else {
            format!(" {}", t!("commands.achievements.progress", locale = &lang_code, 
                current = achievement.progress, 
                target = achievement.target
            ))
        };
        
        let icon = if achievement.unlocked { ">" } else { "-" };
        text.push_str(&format!("{} {}{}\n", icon, name, status));
    }
    
    reply_html(bot, &msg, text).await?;
    Ok(())
}

/// Get all achievements for a user with their progress
async fn get_user_achievements(
    _repos: &Repositories,
    _user_id: i64,
) -> anyhow::Result<Vec<UserAchievement>> {
    // In production, this would query the database
    // For now, return default progress
    let achievements: Vec<UserAchievement> = ACHIEVEMENTS
        .iter()
        .map(|def| UserAchievement {
            key: def.key.to_string(),
            progress: 0,
            target: def.target,
            unlocked: false,
        })
        .collect();
    
    Ok(achievements)
}

/// Check and potentially unlock achievements after an action
pub async fn check_achievements(
    _repos: &Repositories,
    _user_id: i64,
    action: AchievementAction,
) -> anyhow::Result<Vec<String>> {
    let mut newly_unlocked = Vec::new();
    
    match action {
        AchievementAction::FirstGrow => {
            // Check first_bloom
            newly_unlocked.push("first_bloom".to_string());
        }
        AchievementAction::ShowMercy => {
            // Increment mercy counter, check kind_soul_1/2/3
        }
        AchievementAction::WinAsDuel => {
            // Check underdog if in bottom 25%
        }
        AchievementAction::ReachHeight(height) => {
            if height >= 100 {
                newly_unlocked.push("centenarian".to_string());
            }
        }
        AchievementAction::WinSproutOfDay => {
            // Increment counter, check champion
        }
        AchievementAction::ParticipateInEvent => {
            // Increment counter, check traveler
        }
        AchievementAction::GiftItem(_recipient_id) => {
            // Increment unique recipients counter, check generous
        }
    }
    
    Ok(newly_unlocked)
}

/// Actions that can trigger achievement progress
#[derive(Clone, Debug)]
pub enum AchievementAction {
    FirstGrow,
    ShowMercy,
    WinAsDuel,
    ReachHeight(i32),
    WinSproutOfDay,
    ParticipateInEvent,
    GiftItem(i64),
}
