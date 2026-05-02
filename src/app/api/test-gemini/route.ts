import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET() {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        step: "env",
        message:
          "GEMINI_API_KEY NÃO está configurada nas variáveis de ambiente da Vercel.",
      },
      { status: 503 }
    );
  }

  // Mostra os 8 primeiros e últimos chars pra confirmar que tá certa, sem expor toda a chave
  const key = process.env.GEMINI_API_KEY;
  const masked =
    key.length > 16
      ? `${key.slice(0, 8)}...${key.slice(-4)}`
      : "(curta demais)";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Diga apenas: OK");
    const text = result.response.text();

    return NextResponse.json({
      ok: true,
      step: "ok",
      message: "Chave válida e modelo respondendo.",
      keyMasked: masked,
      modelResponse: text.slice(0, 100),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        step: "api",
        message: `Erro ao chamar Gemini: ${msg}`,
        keyMasked: masked,
      },
      { status: 502 }
    );
  }
}
