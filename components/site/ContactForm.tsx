"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, Send } from "lucide-react";
import { FormEvent, useState } from "react";

type ContactFields = {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
};

type FormErrors = Partial<Record<keyof ContactFields, string>>;

const initialFields: ContactFields = {
  name: "",
  email: "",
  company: "",
  subject: "",
  message: "",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields: ContactFields): FormErrors {
  const errors: FormErrors = {};
  if (fields.name.trim().length < 2) errors.name = "Please add your name.";
  if (!emailPattern.test(fields.email.trim())) errors.email = "Please enter a valid email address.";
  if (fields.subject.trim().length < 3) errors.subject = "Please add a short subject.";
  if (fields.message.trim().length < 20) errors.message = "Please share a little more detail (at least 20 characters).";
  return errors;
}

export function ContactForm() {
  const [fields, setFields] = useState<ContactFields>(initialFields);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [formMessage, setFormMessage] = useState("");

  function updateField(field: keyof ContactFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (status !== "idle") {
      setStatus("idle");
      setFormMessage("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    setFormMessage("");
    if (Object.keys(nextErrors).length > 0) {
      setStatus("error");
      setFormMessage("Please check the highlighted fields and try again.");
      return;
    }

    setStatus("sending");
    try {
      const website = new FormData(event.currentTarget).get("website");
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, website: typeof website === "string" ? website : "" }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "The message could not be sent.");
      setStatus("success");
      setFormMessage(result.message || "Thanks — your message has been sent.");
      setFields(initialFields);
      setErrors({});
    } catch (error) {
      setStatus("error");
      setFormMessage(error instanceof Error ? error.message : "The message could not be sent. Please try again.");
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      <div className="form-honeypot" aria-hidden="true">
        <label htmlFor="contact-website">Leave this field empty</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="contact-form-fields">
        <div className="form-field">
          <label htmlFor="contact-name">Name <span aria-hidden="true">*</span></label>
          <input id="contact-name" name="name" autoComplete="name" required aria-required="true" value={fields.name} onChange={(event) => updateField("name", event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "contact-name-error" : undefined} />
          {errors.name ? <span className="form-error" id="contact-name-error">{errors.name}</span> : null}
        </div>
        <div className="form-field">
          <label htmlFor="contact-email">Email <span aria-hidden="true">*</span></label>
          <input id="contact-email" name="email" type="email" autoComplete="email" required aria-required="true" value={fields.email} onChange={(event) => updateField("email", event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "contact-email-error" : undefined} />
          {errors.email ? <span className="form-error" id="contact-email-error">{errors.email}</span> : null}
        </div>
        <div className="form-field">
          <label htmlFor="contact-company">Company / Website <span className="form-optional">Optional</span></label>
          <input id="contact-company" name="company" autoComplete="organization" value={fields.company} onChange={(event) => updateField("company", event.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="contact-subject">Subject <span aria-hidden="true">*</span></label>
          <input id="contact-subject" name="subject" required aria-required="true" value={fields.subject} onChange={(event) => updateField("subject", event.target.value)} aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? "contact-subject-error" : undefined} />
          {errors.subject ? <span className="form-error" id="contact-subject-error">{errors.subject}</span> : null}
        </div>
        <div className="form-field form-field-full">
          <label htmlFor="contact-message">Message <span aria-hidden="true">*</span></label>
          <textarea id="contact-message" name="message" rows={7} required aria-required="true" value={fields.message} onChange={(event) => updateField("message", event.target.value)} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "contact-message-error" : undefined} />
          {errors.message ? <span className="form-error" id="contact-message-error">{errors.message}</span> : null}
        </div>
      </div>
      <div className="contact-form-actions">
        <button className="button button-primary contact-submit" type="submit" disabled={status === "sending"}>
          {status === "sending" ? <LoaderCircle aria-hidden="true" className="spin" size={17} /> : <Send aria-hidden="true" size={17} />}
          <span>{status === "sending" ? "Sending message" : "Send message"}</span>
        </button>
        <p className={`form-status form-status-${status}`} role="status" aria-live="polite">
          {status === "success" ? <CheckCircle2 aria-hidden="true" size={17} /> : null}
          {status === "error" ? <CircleAlert aria-hidden="true" size={17} /> : null}
          {formMessage}
        </p>
      </div>
    </form>
  );
}
