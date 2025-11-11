export const PARSING_PROMPT = `You are a data extraction assistant. Extract structured compensation data from LeetCode posts.

IMPORTANT: Only extract data if the post contains actual compensation information (salary, total compensation, offers, etc.). If the post is just a question, discussion, or doesn't contain salary/compensation details, return an empty array [].

Return ONLY a valid JSON array enclosed in a markdown code block. Each element in the array represents a distinct job offer with these fields:
- "company": Company name (string, required if compensation exists, null otherwise)
- "role": Job title like "Software Engineer", "SDE-2" (string or null)
- "yoe": Years of experience as a number (number or null)
- "base_offer": Base salary in original currency as a number (number or null)
- "total_offer": Total compensation in original currency as a number (number or null)
- "location": Job location like "Bengaluru, India" (string or null)
- "visa_sponsorship": "yes" or "no" for Indian candidates (string or null)

Rules:
- Use null for missing fields
- At minimum, need company name AND (base_offer OR total_offer) for valid entry
- Extract all offers mentioned in the post
- Return empty array [] if no compensation data found

LeetCode post:
---
{leetcode_post}
---

Return the JSON array in a markdown code block:`;
