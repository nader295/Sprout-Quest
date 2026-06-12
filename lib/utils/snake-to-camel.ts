export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

/**
 * تحوّل كل مفاتيح الأوبجكت من snake_case (المستخدمة في Supabase/DB)
 * إلى camelCase (المستخدمة في الـ Frontend).
 */
export function mapToCamelCase<T = Record<string, unknown>>(record: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    // تجاهل الحقول الـ undefined
    if (value === undefined) continue;

    const camelKey = snakeToCamel(key);

    // تحويل خاص لبعض الحقول لو احتجنا (مثلاً total_views لـ total_views عشان التوافق قبل مانعدل الـ frontend)
    // هنا ممكن نحط استثناءات، بس هنلتزم بالتحويل المباشر الأول
    if (key === "total_views") {
      result["total_views"] = value; // نحتفظ بيها لملاءمة الكود القديم لو كان فيها مشكلة
    }
    
    // بعض الحقول القديمة كانت بتحتاج default values بس ده ممكن يتعمل في طبقة الـ validation
    result[camelKey] = value;
  }
  return result as T;
}
