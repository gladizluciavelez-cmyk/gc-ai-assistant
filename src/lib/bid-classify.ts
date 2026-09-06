import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";

export async function classifyProjectType(title: string, extra?: string): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 30,
      system:
        "You classify construction bid/solicitation titles into a short project " +
        "type label (2-4 words), e.g. 'road resurfacing', 'school renovation', " +
        "'water main replacement', 'new government building', 'park improvements'. " +
        "Respond with ONLY the label, nothing else.",
      messages: [
        { role: "user", content: `Title: ${title}${extra ? `\nDetails: ${extra}` : ""}` },
      ],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("")
      .trim();

    return text || "unclassified";
  } catch (err) {
    // A bad/expired ANTHROPIC_API_KEY or transient API error shouldn't stop
    // the whole scrape from saving bids — just leave this one unclassified.
    console.error("classifyProjectType failed, leaving unclassified", err);
    return "unclassified";
  }
}
