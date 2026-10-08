import { NextResponse } from "next/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  subject?: unknown;
  message?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Please send the form as JSON." }, { status: 400 });
  }

  const name = text(payload.name);
  const email = text(payload.email);
  const company = text(payload.company);
  const subject = text(payload.subject);
  const message = text(payload.message);

  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "Please provide a valid name." }, { status: 400 });
  }
  if (!emailPattern.test(email) || email.length > 240) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }
  if (subject.length < 3 || subject.length > 180) {
    return NextResponse.json({ error: "Please provide a short subject." }, { status: 400 });
  }
  if (message.length < 20 || message.length > 5000) {
    return NextResponse.json({ error: "Please provide a message between 20 and 5000 characters." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.CONTACT_EMAIL;
  const sender = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !recipient || !sender) {
    return NextResponse.json(
      { error: "The form is ready, but email delivery still needs CONTACT_EMAIL, CONTACT_FROM_EMAIL, and RESEND_API_KEY configured." },
      { status: 503 },
    );
  }

  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Company / Website: ${company || "Not provided"}`,
    "",
    message,
  ];

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        reply_to: email,
        subject: `Portfolio enquiry: ${subject}`,
        text: lines.join("\n"),
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "The message could not be delivered right now. Please try again later." }, { status: 502 });
    }

    return NextResponse.json({ message: "Thanks — your message has been sent." }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "The message service is unavailable right now. Please try again later." }, { status: 502 });
  }
}
