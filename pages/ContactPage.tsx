import { Info, Mail, MessageSquare } from 'lucide-react';
import { useState } from 'react';

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('General Feedback');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formNotice, setFormNotice] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormNotice('');

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please complete your name, email address, and message.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    // TODO: Connect to a production contact form endpoint or verified mail handler once deployed.
    setFormNotice(
      'Your inputs passed local validation, but this contact form is not yet connected to a live delivery server. No message was transmitted or saved.'
    );
  };

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[#7D5C23] dark:text-[#D9B978]">
            Contact Us
          </p>
          <h1 className="mt-2.5 font-display text-3xl font-bold tracking-tight text-[#252B28] sm:text-4xl dark:text-[#F2F0E9]">
            Get in Touch
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
            Questions, bug reports, or tool suggestions for AI Utility Hub? Check
            current contact availability and form status below.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Contact Details */}
          <div className="space-y-6 lg:col-span-5">
            <div className="divide-y divide-[#DCDDD3] rounded-2xl border border-[#DCDDD3] bg-white p-6 shadow-[0_1px_2px_rgba(23,63,53,0.03)] dark:divide-[#35463E] dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-none">
              <div className="flex items-start gap-3.5 pb-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EDE9DF] text-[#173F35] dark:bg-[#17231F] dark:text-[#D9B978]">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    Contact Availability
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                    A verified public support email address will be published
                    here once the production domain and inbox are finalized.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 pt-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EDE9DF] text-[#173F35] dark:bg-[#17231F] dark:text-[#D9B978]">
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    Tool Suggestions &amp; Bug Feedback
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                    When reporting a tool issue once live support opens, noting
                    your browser version, file format, and approximate file size
                    helps diagnose issues faster.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form (Pre-Launch Status Notice + Ready Form Structure) */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-[#DCDDD3] bg-white p-6 sm:p-8 dark:border-[#35463E] dark:bg-[#24332C]">
              <div
                role="note"
                className="mb-6 flex items-start gap-3 rounded-xl border border-[#C49A58]/45 bg-[#EDE9DF]/65 px-4 py-3.5 text-xs leading-relaxed text-[#252B28] dark:border-[#D9B978]/35 dark:bg-[#17231F] dark:text-[#F2F0E9]"
              >
                <Info
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#7D5C23] dark:text-[#D9B978]"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    Contact Form Not Yet Connected
                  </p>
                  <p className="mt-0.5 text-[#56615B] dark:text-[#B9C5BD]">
                    This pre-launch form checks field formatting in your browser
                    only and is not yet wired to an email inbox or backend
                    endpoint. Submitting does not transmit any data.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                    >
                      Full Name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (formNotice) setFormNotice('');
                      }}
                      placeholder="Alex Morgan"
                      className="mt-1.5 h-11 w-full rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/35 px-3.5 text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                    >
                      Email Address
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (formNotice) setFormNotice('');
                      }}
                      placeholder="you@example.com"
                      className="mt-1.5 h-11 w-full rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/35 px-3.5 text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact-topic"
                    className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                  >
                    Topic
                  </label>
                  <select
                    id="contact-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/35 px-3.5 text-sm text-[#252B28] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:focus:border-[#D9B978]"
                  >
                    <option value="General Feedback">General Feedback</option>
                    <option value="New Tool Request">New Tool Request</option>
                    <option value="Design & Accessibility">
                      Design &amp; Accessibility
                    </option>
                    <option value="Bug Report">Bug Report</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (formNotice) setFormNotice('');
                    }}
                    placeholder="Share your feedback or question..."
                    className="mt-1.5 w-full rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/35 p-3.5 text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="text-xs font-medium text-red-700 dark:text-red-300"
                  >
                    {error}
                  </p>
                )}

                {formNotice && (
                  <p
                    role="status"
                    className="rounded-lg border border-[#C49A58]/45 bg-[#EDE9DF]/65 px-3.5 py-2.5 text-xs leading-relaxed font-medium text-[#252B28] dark:border-[#D9B978]/35 dark:bg-[#17231F] dark:text-[#F2F0E9]"
                  >
                    {formNotice}
                  </p>
                )}

                <button
                  type="submit"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#173F35] px-6 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 sm:w-auto dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
                >
                  Check Form (Preview Only)
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
