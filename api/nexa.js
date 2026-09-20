export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { message, context } = req.body || {};

        if (!message || !message.trim()) {
            return res.status(400).json({
                error: "Message is required"
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error("GEMINI_API_KEY is missing");

            return res.status(500).json({
                error: "Nexa API key is not configured on the server."
            });
        }

        const systemInstruction = `
You are Nexa, the AI assistant for HostelPro.

HostelPro is a hostel management system with these roles:
- Admin
- Caretaker
- Warden
- Student

Your job is to help users understand and use HostelPro.

IMPORTANT:
- Be accurate.
- Do not invent hostel, room, bed, student, allocation, maintenance,
  message, or announcement information.
- When database information is provided in the context, use that information.
- If the required information is not provided, clearly say that you
  cannot access that information yet.
- Keep answers clear and useful.
- Do not reveal API keys, passwords, tokens, or confidential credentials.
- Do not claim to have performed an action unless the system actually
  performed it.

HostelPro database context:
${context || "No database context was supplied."}
`;

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [
                            {
                                text: systemInstruction
                            }
                        ]
                    },
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    text: message
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 800
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API error:", data);

            return res.status(response.status).json({
                error: "Gemini API request failed.",
                details: data?.error?.message || "Unknown Gemini error"
            });
        }

        const answer =
            data?.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("")
                .trim();

        if (!answer) {
            return res.status(500).json({
                error: "Nexa received an empty response."
            });
        }

        return res.status(200).json({
            answer
        });

    } catch (error) {
        console.error("Nexa server error:", error);

        return res.status(500).json({
            error: "Nexa encountered a server error."
        });
    }
}