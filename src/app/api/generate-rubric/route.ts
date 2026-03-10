import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return NextResponse.json(
        { error: "Transcript is empty" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are an AI assistant helping a teacher build a grading rubric.
Convert the following voice transcript into a structured JSON array.

Transcript: "${transcript}"

Output ONLY a valid JSON array of objects with this exact structure, nothing else:
[
  {
    "criteria": "string (e.g., 'Q1 - Core Definition')",
    "max_marks": number,
    "description": "string (brief grading instruction)"
  }
]

Rules:
- Extract every distinct question or marking criterion mentioned.
- If the teacher says "Question 1 is worth 5 marks", create an entry with max_marks: 5.
- Combine related sub-points under one criterion when logical.
- Use clear, concise labels (e.g. "Q1: Neural Network Definition").
- If the teacher mentions partial credit rules, include them in the description.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean up markdown formatting Gemini sometimes adds
    const cleanJson = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanJson);

    // Ensure it's an array
    const criteria = Array.isArray(parsed) ? parsed : parsed.criteria || [];

    return NextResponse.json({
      criteria,
      questions_detected: criteria.length,
      total_marks: criteria.reduce(
        (sum: number, c: { max_marks?: number; marks?: number }) =>
          sum + (c.max_marks ?? c.marks ?? 0),
        0
      ),
      transcript,
    });
  } catch (error) {
    console.error("Voice-to-rubric error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate rubric",
      },
      { status: 500 }
    );
  }
}
