import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const PIPEFY_GRAPHQL = "https://api.pipefy.com/graphql";

const CARD_QUERY = `
  query GetCard($id: ID!) {
    card(id: $id) {
      id
      title
      done
      created_at
      updated_at
      due_date
      current_phase { id name }
      labels { id name color }
      comments { id text created_at author { name } }
      phases_history {
        phase { id name }
        firstTimeIn
        lastTimeIn
        duration
      }
      fields {
        field { id label type }
        value
        array_value
        date_value
      }
    }
  }
`;

async function fetchCard(cardId: string, token: string) {
  const res = await fetch(PIPEFY_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: CARD_QUERY, variables: { id: cardId } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Pipefy API: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors?.length) {
    const msg = json.errors.map((e: { message: string }) => e.message).join("; ");
    throw new Error(`Pipefy GraphQL: ${msg}`);
  }
  return json.data?.card ?? null;
}

function parseCardId(url: string): string {
  const openCard = url.match(/open-cards\/(\d+)/i);
  if (openCard) return openCard[1];
  const pipeCard = url.match(/[#/]cards?\/(\d+)/i);
  if (pipeCard) return pipeCard[1];
  const fallback = url.match(/(\d{6,})/);
  if (fallback) return fallback[1];
  throw new Error("Não foi possível extrair o ID do card. Use https://app.pipefy.com/open-cards/ID");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardUrl, pipefyToken } = body as {
      cardUrl: string;
      pipefyToken?: string;
    };

    const token = pipefyToken?.trim() || process.env.PIPEFY_API_TOKEN || "";
    if (!token) {
      return NextResponse.json(
        { error: "Token do Pipefy não configurado." },
        { status: 400 }
      );
    }
    if (!cardUrl?.trim()) {
      return NextResponse.json({ error: "URL do card não fornecida." }, { status: 400 });
    }

    let cardId: string;
    try {
      cardId = parseCardId(cardUrl);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "URL inválida." },
        { status: 400 }
      );
    }

    let card;
    try {
      card = await fetchCard(cardId, token);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Erro ao buscar card." },
        { status: 502 }
      );
    }
    if (!card) {
      return NextResponse.json(
        { error: "Card não encontrado." },
        { status: 404 }
      );
    }

    const sortedComments = [...(card.comments ?? [])].sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const context = {
      title: card.title,
      current_phase: card.current_phase?.name ?? null,
      labels: (card.labels ?? []).map((l: { name: string }) => l.name),
      comments: sortedComments.slice(0, 15).map((c: { text: string; created_at: string }) => ({
        text: c.text,
        created_at: c.created_at,
      })),
      phases_history: (card.phases_history ?? []).map((h: { phase: { name: string } }) => ({
        phase_name: h.phase?.name,
      })),
    };

    const prompt = `Você é um analista da Branddi Monitor. Analise os dados do card e preencha os campos.

DADOS:
${JSON.stringify(context, null, 2)}

INSTRUÇÕES:
1. nomeAgressor: use o "title".
2. etiquetaTopLeilao: "Ativada" se houver label com "Top Leilão", senão "Não ativada".
3. notificacoesEnviadas: conte entradas em phases_history com "Quarentena" no phase_name.
4. ultimaComunicacao: data mais recente em comments[].created_at no formato DD/MM/AAAA, ou null.
5. retorno: "Sim" se houver label com "Respondeu"/"Respondido"/"Confirmou a negativação", senão "Não".
6. observacao: resumo estratégico em PORTUGUÊS, MÁXIMO 200 caracteres. Sem inventar.

Retorne SOMENTE JSON válido:
{
  "nomeAgressor": "string",
  "etiquetaTopLeilao": "Ativada" | "Não ativada",
  "notificacoesEnviadas": number,
  "ultimaComunicacao": "DD/MM/AAAA" | null,
  "retorno": "Sim" | "Não",
  "observacao": "string"
}`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const aiResult = await model.generateContent(prompt);
    const rawText = aiResult.response.text();

    let result: unknown;
    try {
      const clean = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      result = JSON.parse(clean);
    } catch {
      return NextResponse.json({
        success: false,
        error: "A IA não retornou JSON válido.",
        rawResponse: rawText,
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("resumo-tratativa error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro." },
      { status: 500 }
    );
  }
}
