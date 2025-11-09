export const PARSING_PROMPT = `
Please extract the structured data from the LeetCode compensation post provided below. The output should be a JSON object enclosed in a markdown code block.

IMPORTANT: Only extract data if the post contains actual compensation information. If the post is just a question, discussion, or doesn't contain salary/compensation details, return an empty array [].

The JSON object should be an array, where each element represents a distinct offer and has the following fields:
- "company": The name of the company (required if compensation data exists).
- "role": The job title (e.g., "Software Engineer", "SDE-2"). Can be null if not mentioned.
- "yoe": Years of experience as a number. Can be null if not mentioned.
- "base_offer": The base salary in the original currency, as a number. Can be null if not mentioned.
- "total_offer": The total compensation in the original currency, as a number. Can be null if not mentioned.
- "location": The actual job location (e.g., "Bengaluru, India", "Seattle, USA", "London, UK"). Can be null if not mentioned.
- "visa_sponsorship": A string "yes" or "no", indicating if the company provides VISA sponsorship for Indian candidates. Can be null if not mentioned or unclear.

Note: If a field is not mentioned in the post, use null for that field. However, at minimum, you must have a company name and either base_offer or total_offer for the entry to be valid.

Here is the LeetCode post:
---
{leetcode_post}
---
`;
