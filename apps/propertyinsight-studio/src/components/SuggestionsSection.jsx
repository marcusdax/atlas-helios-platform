import React, { useState } from 'react';
import { api } from '../lib/api';
import { useAsyncAction } from '../lib/useAsyncAction';
import { Alert, Button, Panel, Section, TextArea } from './ui';

/**
 * Improvement suggestions for a described property.
 *
 * The list feeds the render studio: clicking a suggestion is the fastest path
 * from "this house looks tired" to a specific, renderable instruction, which is
 * the step the template left the user to type from scratch.
 */
export default function SuggestionsSection({ industry, onUseSuggestion }) {
  const [observation, setObservation] = useState('A dated 1970s ranch home with a tired street-facing elevation');
  const suggestions = useAsyncAction((body, signal) => api.suggestions(body, signal));

  return (
    <Section
      id="suggestions"
      kicker="Discovery"
      title="Improvement suggestions"
      description="Describe the property in general terms and get specific, sellable changes scoped to the selected trade."
    >
      <Panel>
        <TextArea
          id="observation"
          label="Property type and condition"
          rows={2}
          maxLength={600}
          counter
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
          placeholder="e.g. a neglected backyard, a modern condo needing a refresh"
        />

        <Button
          tone="accent"
          busy={suggestions.isPending}
          busyLabel="Thinking…"
          disabled={!observation.trim()}
          onClick={() => suggestions.run({ industry, observation })}
        >
          Suggest improvements
        </Button>

        <div aria-live="polite" className="empty:hidden">
          {suggestions.errorMessage && <Alert tone="error">{suggestions.errorMessage}</Alert>}

          {!suggestions.errorMessage && suggestions.data?.suggestions?.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Suggested improvements</p>
              <ul className="mt-2 space-y-2">
                {suggestions.data.suggestions.map((suggestion) => (
                  <li key={suggestion} className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span className="flex-1 text-sm leading-relaxed text-slate-800">{suggestion}</span>
                    {/* Hands the text straight to the render input rather than
                        making the user retype it. */}
                    <button
                      type="button"
                      onClick={() => onUseSuggestion(suggestion)}
                      className="shrink-0 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      Render this
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Panel>
    </Section>
  );
}
