use rust_i18n::t;
use teloxide::Bot;
use teloxide::macros::BotCommands;
use teloxide::types::Message;
use crate::domain::LanguageCode;
use crate::handlers::{reply_html, HandlerResult};
use crate::repo::Repositories;

#[derive(BotCommands, Clone)]
#[command(rename_rule = "lowercase")]
pub enum ReferralCommands {
    #[command(description = "referral")]
    Referral,
    #[command(description = "referral")]
    Ref,
    #[command(description = "referral")]
    Invite,
}

/// Handle /referral command
pub async fn cmd_handler(
    bot: Bot,
    msg: Message,
    repos: Repositories,
) -> HandlerResult {
    let user = msg.from.as_ref().ok_or("no FROM field")?;
    let lang_code = LanguageCode::from_maybe_user(Some(user));
    let user_id = user.id.0 as i64;
    
    // Get or create referral code for user
    let code = get_or_create_referral_code(&repos, user_id, &user.first_name).await?;
    
    // Get referral stats
    let stats = get_referral_stats(&repos, user_id).await?;
    
    let text = format!(
        "{}\n\n{}",
        t!("commands.referral.your_code", locale = &lang_code, code = code),
        t!("commands.referral.stats", locale = &lang_code, 
            count = stats.successful_referrals,
            bonus = stats.total_bonus_cm
        )
    );
    
    reply_html(bot, &msg, text).await?;
    Ok(())
}

/// Get or create a referral code for a user
async fn get_or_create_referral_code(
    _repos: &Repositories,
    user_id: i64,
    first_name: &str,
) -> anyhow::Result<String> {
    // In production, query/insert into database
    // Format: SPROUT-NAME-XXXX
    let name_part: String = first_name
        .chars()
        .filter(|c| c.is_alphanumeric())
        .take(6)
        .collect::<String>()
        .to_uppercase();
    
    let name_part = if name_part.is_empty() {
        "USER".to_string()
    } else {
        name_part
    };
    
    // Generate random suffix based on user_id for consistency
    let suffix = format!("{:03X}", (user_id % 4096) as u16);
    
    Ok(format!("SPROUT-{}-{}", name_part, suffix))
}

/// Referral statistics
#[derive(Default)]
struct ReferralStats {
    successful_referrals: u32,
    total_bonus_cm: i32,
    total_bonus_sunbeams: u32,
}

/// Get referral stats for a user
async fn get_referral_stats(_repos: &Repositories, _user_id: i64) -> anyhow::Result<ReferralStats> {
    // In production, query the database
    Ok(ReferralStats::default())
}

/// Process a new referral when a user joins via referral code
pub async fn process_referral(
    _repos: &Repositories,
    _referrer_id: i64,
    _referee_id: i64,
    _code: &str,
) -> anyhow::Result<()> {
    // 1. Record the referral relationship
    // 2. Give referee 50 sunbeams + fertilizer
    // 3. Mark referral as pending until referee reaches 25cm
    Ok(())
}

/// Claim referral reward when referee reaches threshold
pub async fn claim_referral_reward(
    _repos: &Repositories,
    _referrer_id: i64,
    _referee_id: i64,
) -> anyhow::Result<(i32, u32)> {
    // 1. Give referrer 1cm + 30 sunbeams
    // 2. Mark referral reward as claimed
    // 3. Check for tier bonuses (5/10/25/50 referrals)
    Ok((1, 30)) // (bonus_cm, bonus_sunbeams)
}
