// Generate a personality/system prompt grounded in scraped evidence.

import { mockGeneratedPrompt } from "./mock-data.js";

const MAX_LIST_ITEMS = 5;
const MAX_EXCERPTS = 6;
const MAX_TIMELINE_POINTS = 5;

export async function createPersonalityPrompt(scrapedData = {}) {
  const items = extractContentItems(scrapedData);

  if (items.length === 0) {
    // No usable evidence yet – fall back to the legacy demo prompt.
    return mockGeneratedPrompt;
  }

  const displayName = resolveDisplayName(scrapedData);
  const summary = scrapedData.summary || {};

  const contextSummary = formatTopList(
    countBy(items, (item) => item.context || "general"),
    MAX_LIST_ITEMS
  );
  const topicSummary = formatTopList(
    countBy(items, (item) => item.topic || "unspecified subject"),
    MAX_LIST_ITEMS
  );
  const sentimentSummary = formatTopList(
    countBy(items, (item) => item.sentiment || "neutral"),
    MAX_LIST_ITEMS
  );
  const domainSummary = formatTopList(
    countBy(items, (item) => item.knowledge_domain || "general knowledge"),
    MAX_LIST_ITEMS
  );
  const beliefSummary = formatBeliefList(items, MAX_LIST_ITEMS);
  const peopleSummary = formatPeopleList(items, MAX_LIST_ITEMS);
  const excerpts = buildExcerptBullets(items, MAX_EXCERPTS);
  const timeline = buildTimeline(items, MAX_TIMELINE_POINTS);

  const highLevel = [
    summary.profession && `- Profession / role: ${summary.profession}`,
    summary.communicationStyle &&
      `- Communication style: ${summary.communicationStyle}`,
    Array.isArray(summary.personalityTraits) &&
    summary.personalityTraits.length > 0
      ? `- Personality traits: ${summary.personalityTraits.join(", ")}`
      : null,
    Array.isArray(summary.interests) && summary.interests.length > 0
      ? `- Key interests: ${summary.interests.join(", ")}`
      : null,
    summary.background && `- Background: ${summary.background}`,
    summary.recentActivity && `- Recent activity: ${summary.recentActivity}`,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `You are ${displayName}, derived entirely from the documented evidence below. Do not deviate from this personality or invent details not supported by the evidence.`,
    "",
    highLevel ? `High-level context from structured data:\n${highLevel}\n` : "",
    `Observed communication contexts:\n${contextSummary}`,
    "",
    `Dominant themes:\n${topicSummary}`,
    "",
    `Knowledge domains referenced:\n${domainSummary}`,
    "",
    `Prevailing sentiment / tone:\n${sentimentSummary}`,
    "",
    beliefSummary
      ? `Representative beliefs and viewpoints:\n${beliefSummary}\n`
      : "",
    peopleSummary
      ? `Frequently referenced individuals:\n${peopleSummary}\n`
      : "",
    `Key excerpts to emulate:\n${
      excerpts.length > 0
        ? excerpts.join("\n")
        : "- No quotable material captured."
    }`,
    "",
    timeline.length > 0
      ? `Chronological markers:\n${timeline.join("\n")}\n`
      : "",
    "When responding:",
    "- Stay authentic to this evidence; do not invent facts or attitudes that are not documented.",
    "- Cite or paraphrase the documented material whenever possible.",
    "- Maintain the historical, cultural, and moral framing reflected in these sources.",
    "- If a question falls outside the available evidence, acknowledge the gap rather than speculating.",
    "- Preserve tone, speaking style, and any notable mannerisms that appear in the excerpts.",
    "- Preserve tone, speaking style, and any notable mannerisms that appear in the excerpts.",
  ]
    .filter(Boolean)
    .join("\n");
}

function resolveDisplayName(scrapedData) {
  return (
    scrapedData?.person_name ||
    scrapedData?.summary?.fullName ||
    scrapedData?.summary?.displayName ||
    "the profiled individual"
  );
}

function extractContentItems(scrapedData) {
  const items = [];
  const sources = Array.isArray(scrapedData?.scraped_content)
    ? scrapedData.scraped_content
    : [];

  for (const source of sources) {
    for (const item of source.content_items || []) {
      if (!item || typeof item !== "object") continue;
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) continue;
      items.push({ ...item, text });
    }
  }

  return items;
}

function countBy(items, selector) {
  const counts = new Map();

  for (const item of items) {
    const key = selector(item);
    if (!key) continue;
    const normalized = key.toString().trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function formatTopList(list, limit) {
  if (!list || list.length === 0) {
    return "- Not enough evidence captured.";
  }

  return list
    .slice(0, limit)
    .map(
      ({ label, count }) =>
        `- ${label} (seen ${count} time${count === 1 ? "" : "s"})`
    )
    .join("\n");
}

function formatBeliefList(items, limit) {
  const beliefs = dedupeStrings(
    items
      .map((item) => item.belief_expressed)
      .filter(
        (belief) => typeof belief === "string" && belief.trim().length > 0
      )
      .map((belief) => belief.trim())
  );

  if (beliefs.length === 0) {
    return "";
  }

  return beliefs
    .slice(0, limit)
    .map((belief) => `- ${belief}`)
    .join("\n");
}

function formatPeopleList(items, limit) {
  const tally = new Map();

  for (const item of items) {
    const people = Array.isArray(item.people_mentioned)
      ? item.people_mentioned
      : [];
    for (const person of people) {
      const normalized = person && person.toString().trim();
      if (!normalized) continue;
      tally.set(normalized, (tally.get(normalized) || 0) + 1);
    }
  }

  const list = Array.from(tally.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (list.length === 0) {
    return "";
  }

  return list
    .slice(0, limit)
    .map(
      ({ label, count }) =>
        `- ${label} (referenced ${count} time${count === 1 ? "" : "s"})`
    )
    .join("\n");
}

function buildExcerptBullets(items, limit) {
  const bullets = [];

  for (const item of items) {
    const excerpt = trimToLength(item.text, 260);
    const annotation = [
      item.date ? `Date: ${item.date}` : null,
      item.context || null,
      item.topic || null,
      item.response_pattern
        ? `Response pattern: ${item.response_pattern}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");

    bullets.push(`- "${excerpt}"${annotation ? ` (${annotation})` : ""}`);

    if (bullets.length >= limit) break;
  }

  return bullets;
}

function buildTimeline(items, limit) {
  const dated = items
    .filter((item) => item.date)
    .map((item) => ({
      date: item.date,
      summary: trimToLength(item.text, 180),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (dated.length === 0) {
    return [];
  }

  return dated
    .slice(0, limit)
    .map((entry) => `- ${entry.date}: ${entry.summary}`);
}

function trimToLength(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function dedupeStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    result.push(value);
  }

  return result;
}
