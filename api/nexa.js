export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {

        const { message } = req.body;

        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "meta-llama/llama-3.1-8b-instruct:free",

                    messages: [
                        {
                            role: "system",
                            content: `
You are Nexa, the AI assistant of HostelPro.

Rules:
- Help students, wardens, caretakers and admins.
- Answer hostel questions.
- Be friendly like Meta AI.
- If asked about rooms, beds or hostels, provide clear answers.
- Keep replies short unless detailed information is requested.
`
                        },
                        {
                            role: "user",
                            content: message
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        return res.status(200).json({
            reply:
                data.choices?.[0]?.message?.content ||
                "No response from Nexa."
        });

    } catch (error) {

        return res.status(500).json({
            error: error.message
        });
    }
}