"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Search,
  Link,
  FileText,
  Clock,
  Shield,
  Eye,
  TrendingUp,
} from "lucide-react";

// ----- Types -----
interface ExtractedClaim {
  id: number;
  short_claim: string;
  entities: string[];
  possible_dates: string[];
  claim_type: string;
  original_text_excerpt: string;
}

interface SourceCredibility {
  domain: string;
  domain_cred_score: number;
  trust_labels: string[];
  rationale: string;
}

interface ClaimCheck {
  logical_score: number;
  logical_issue: string;
  tonality_score: number;
  tonality_flags: string[];
  short_reason: string;
}

interface EvidenceResult {
  claim: string;
  verdict: string;
  confidence: number;
  supporting_evidence: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  refuting_evidence: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  explanation: string;
}

interface ProcessedClaim extends ExtractedClaim {
  sources?: SourceCredibility[];
  claim_checks?: ClaimCheck;
  evidence_result?: EvidenceResult;
  evidence_checking?: boolean;
}

// ----- Network helpers -----
async function callFactcheckApi(query: string) {
  const resp = await fetch("/api/claims", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Extractor failed (${resp.status}): ${errText}`);
  }
  return resp.json();
}

async function callJson(url: string, body: any, timeoutMs = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const contentType = resp.headers.get("content-type") ?? "";
    const parsed = contentType.includes("application/json")
      ? await resp.json()
      : await resp.text();
    if (!resp.ok)
      throw new Error(
        typeof parsed === "string" ? parsed : JSON.stringify(parsed)
      );
    return parsed;
  } finally {
    clearTimeout(id);
  }
}

// ----- Utilities -----
function normalizeClaim(raw: any, idx: number): ProcessedClaim {
  return {
    id: typeof raw.id === "number" ? raw.id : idx + 1,
    short_claim:
      raw.short_claim ?? raw.claim ?? raw.text ?? String(raw).slice(0, 200),
    entities: Array.isArray(raw.entities) ? raw.entities : [],
    possible_dates: Array.isArray(raw.possible_dates) ? raw.possible_dates : [],
    claim_type: raw.claim_type ?? raw.type ?? "unknown",
    original_text_excerpt:
      raw.original_text_excerpt ??
      raw.excerpt ??
      raw.text ??
      String(raw).slice(0, 200),
  };
}

function extractClaimsFromRunResult(
  runResult: any,
  fallbackInput: string
): ProcessedClaim[] {
  let extracted: ProcessedClaim[] = [];

  if (Array.isArray(runResult?.claims) && runResult.claims.length > 0) {
    extracted = runResult.claims.map((c: any, i: number) =>
      normalizeClaim(c, i)
    );
  } else if (
    Array.isArray(runResult?.results) &&
    runResult.results.length > 0
  ) {
    extracted = runResult.results.map((c: any, i: number) =>
      normalizeClaim(c, i)
    );
  } else if (Array.isArray(runResult?.items) && runResult.items.length > 0) {
    extracted = runResult.items.map((c: any, i: number) =>
      normalizeClaim(c, i)
    );
  } else {
    const possibleText = (runResult?.output?.text ?? runResult?.text ?? "")
      .toString()
      .trim();
    if (possibleText) {
      try {
        const parsed = JSON.parse(possibleText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          extracted = parsed.map((c: any, i: number) => normalizeClaim(c, i));
        } else if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.claims) && parsed.claims.length > 0) {
            extracted = parsed.claims.map((c: any, i: number) =>
              normalizeClaim(c, i)
            );
          } else {
            extracted = [normalizeClaim(parsed, 0)];
          }
        }
      } catch (e) {
        // not JSON — ignore
      }
    }
  }

  if (extracted.length === 0) {
    extracted = [
      {
        id: 1,
        short_claim: fallbackInput.trim().slice(0, 1000),
        entities: [],
        possible_dates: [],
        claim_type: "unknown",
        original_text_excerpt: fallbackInput.trim().slice(0, 300),
      },
    ];
  }

  return extracted;
}

function makeEmptyEvidenceResult(
  claimText: string,
  reason = "No result",
  verdict = "Insufficient evidence",
  confidence = 30
): EvidenceResult {
  return {
    claim: claimText,
    verdict,
    confidence,
    supporting_evidence: [],
    refuting_evidence: [],
    explanation: reason,
  };
}

// ----- Component -----
export function FactChecker({ initialText }: { initialText?: string }) {
  const [input, setInput] = useState(initialText ?? "");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [claims, setClaims] = useState<ProcessedClaim[]>([]);
  const [inputType, setInputType] = useState<"text" | "url">("text");
  const [overallScore, setOverallScore] = useState<number | null>(null);

  // ----- UI helper getters -----
  const getVerdictColor = (verdict: string) => {
    switch (verdict.toLowerCase()) {
      case "true":
      case "mostly true":
        return "success";
      case "false":
      case "likely false":
      case "mostly false":
        return "destructive";
      case "mixed":
      case "unverified":
      case "insufficient evidence":
        return "warning";
      default:
        return "secondary";
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict.toLowerCase()) {
      case "true":
      case "mostly true":
        return <CheckCircle className="h-5 w-5" />;
      case "false":
      case "likely false":
      case "mostly false":
        return <XCircle className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getCredibilityColor = (score: number) => {
    if (score >= 0.8) return "success";
    if (score >= 0.5) return "warning";
    return "destructive";
  };

  // ----- Actions -----
  const detectInputType = (value: string) => {
    const urlPattern = /^https?:\/\/.+/i;
    setInputType(urlPattern.test(value.trim()) ? "url" : "text");
  };

  const handleFactCheck = async () => {
    if (!input.trim()) return;
    setIsExtracting(true);
    setOverallScore(null);
    setClaims([]);

    try {
      const runResult = await callFactcheckApi(input.trim());

      const extracted = extractClaimsFromRunResult(runResult, input);

      // If extractor provided claim_checks or metadata embed them
      const withChecks = extracted.map((c) => {
        const meta =
          (Array.isArray(runResult.claims) &&
            runResult.claims.find((rc: any) => rc.id == c.id)) ||
          (Array.isArray(runResult.results) &&
            runResult.results.find((rc: any) => rc.id == c.id)) ||
          null;
        return {
          ...c,
          claim_checks: meta?.claim_checks ?? undefined,
        } as ProcessedClaim;
      });

      setClaims(withChecks);
      setIsExtracting(false);
      setIsAnalyzing(true);
      setOverallScore(72);

      // auto-run the first claim verification (pass the fresh claim object to avoid stale state)
      setTimeout(() => {
        setClaims((prev) =>
          prev.map((c, i) => (i === 0 ? { ...c, evidence_checking: true } : c))
        );

        setTimeout(() => {
          const first = withChecks[0];
          if (first) {
            handleEvidenceCheck(first.id, first)
              .catch((err) => console.error("Auto evidence check failed:", err))
              .finally(() => {
                // ensure spinner cleared and analysis flag updated
                setClaims((prev) =>
                  prev.map((c) =>
                    c.id === first.id ? { ...c, evidence_checking: false } : c
                  )
                );
                setIsAnalyzing(false);
              });
          } else {
            setIsAnalyzing(false);
          }
        }, 150);
      }, 500);
    } catch (err: any) {
      console.error("Fact check failed:", err);
      setIsExtracting(false);
      setIsAnalyzing(false);
      alert("Fact check failed: " + (err?.message ?? "unknown error"));
    }
  };

  // claimParam avoids stale-state when auto-running immediately after setClaims
  const handleEvidenceCheck = async (
    claimId: number,
    claimParam?: ProcessedClaim
  ) => {
    const claim = claimParam ?? claims.find((c) => c.id === claimId);
    if (!claim) {
      console.warn("handleEvidenceCheck: claim not found", { claimId });
      return;
    }

    // show spinner
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claimId ? { ...c, evidence_checking: true } : c
      )
    );

    try {
      // 1) claim-verify
      const verifyResp = await callJson("/api/claim-verify", {
        claim_id: claimId,
        claim: claim.short_claim,
        snippets:
          claim.sources?.map((s: any) => ({
            title: s.title ?? s.domain ?? undefined,
            url: (s as any).url ?? undefined,
            domain: s.domain ?? undefined,
            snippet: s.rationale ?? (s as any).snippet ?? undefined,
          })) ?? [],
      });

      const claimChecks: ClaimCheck | undefined =
        verifyResp?.claim_checks ?? undefined;
      const snippetChecks: any[] = verifyResp?.snippet_checks ?? [];

      // merge claim_checks
      setClaims((prev) =>
        prev.map((c) =>
          c.id === claimId ? { ...c, claim_checks: claimChecks } : c
        )
      );

      // 2) source-cred
      const domains = Array.from(
        new Set(
          (claim.sources ?? [])
            .map((s: any) => s.domain)
            .filter(Boolean)
            .concat(snippetChecks.map((s) => s.domain).filter(Boolean))
        )
      );

      let sourceCredResp: any = null;
      if (domains.length) {
        sourceCredResp = await callJson("/api/source-cred", {
          claim_id: claimId,
          domains,
        });
        if (sourceCredResp?.sources) {
          setClaims((prev) =>
            prev.map((c) =>
              c.id === claimId ? { ...c, sources: sourceCredResp.sources } : c
            )
          );
        }
      }

      // 3) claim-assess
      const assessQuery = `Verify claim: ${claim.short_claim}`;
      const assessResp = await callJson("/api/claim-assess", {
        claim_id: claimId,
        query: assessQuery,
      });

      // --- replace existing finalEvidenceResult construction with this ---
      const rawConfidence = assessResp?.confidence;
      const confidencePct =
        typeof rawConfidence === "number"
          ? // if agent returns 0-1 floats, convert to percent; otherwise assume already 0-100
            rawConfidence <= 1
            ? Math.round(rawConfidence * 100)
            : Math.round(rawConfidence)
          : 30;

      const finalEvidenceResult: EvidenceResult = {
        claim: String(assessResp?.claim ?? claim.short_claim),
        verdict: String(assessResp?.verdict ?? "Insufficient evidence"),
        confidence: confidencePct,
        supporting_evidence: Array.isArray(assessResp?.supporting_evidence)
          ? assessResp.supporting_evidence.map((s: any) => ({
              title: s.title ?? s.domain ?? "source",
              url: s.url ?? "",
              snippet: s.snippet ?? s.rationale ?? "",
            }))
          : [],
        refuting_evidence: Array.isArray(assessResp?.refuting_evidence)
          ? assessResp.refuting_evidence.map((s: any) => ({
              title: s.title ?? s.domain ?? "source",
              url: s.url ?? "",
              snippet: s.snippet ?? s.rationale ?? "",
            }))
          : [],
        explanation: String(
          assessResp?.explanation ?? verifyResp?.explanation ?? ""
        ),
      };

      // Merge results into claim
      setClaims((prev) =>
        prev.map((c) =>
          c.id === claimId
            ? {
                ...c,
                evidence_checking: false,
                claim_checks: {
                  ...(c.claim_checks ?? {}),
                  ...(claimChecks ?? {}),
                } as ClaimCheck,
                evidence_result: finalEvidenceResult,
                sources: c.sources ?? sourceCredResp?.sources ?? c.sources,
              }
            : c
        )
      );
    } catch (err: any) {
      console.error("handleEvidenceCheck error", err);
      const errExplanation = String(err?.message ?? err ?? "Unknown error");
      const errorEvidenceResult = makeEmptyEvidenceResult(
        claim.short_claim,
        errExplanation,
        "error",
        0
      );
      setClaims((prev) =>
        prev.map((c) =>
          c.id === claimId
            ? {
                ...c,
                evidence_checking: false,
                evidence_result: errorEvidenceResult,
              }
            : c
        )
      );
    }
  };

  return (
    <div className="space-y-8">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste a URL or enter text content to fact-check..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              detectInputType(e.target.value);
            }}
            className="min-h-[120px] max-h-[200px] overflow-y-auto bg-input border-border/50 resize-none"
          />
          <Button
            onClick={handleFactCheck}
            disabled={!input.trim() || isExtracting || isAnalyzing}
            className="w-full"
            size="lg"
          >
            {isExtracting ? (
              <>
                <Search className="mr-2 h-4 w-4 animate-spin" />
                Extracting claims...
              </>
            ) : isAnalyzing ? (
              <>
                <Shield className="mr-2 h-4 w-4 animate-spin" />
                Analyzing claims...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Fact Check
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {claims.length > 0 && (
        <div className="space-y-6">
          {claims.map((claim, index) => (
            <Card
              key={claim.id}
              className="border-border/50 bg-card/50 backdrop-blur-sm"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <CardTitle className="text-lg leading-tight">
                      {claim.short_claim}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {claim.claim_type}
                    </Badge>
                  </div>
                  {claim.evidence_result && (
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          getVerdictColor(claim.evidence_result.verdict) as any
                        }
                        className="flex items-center gap-2 text-base font-semibold px-3 py-1.5"
                      >
                        {getVerdictIcon(claim.evidence_result.verdict)}
                        {claim.evidence_result.verdict.toUpperCase()}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-base font-semibold px-3 py-1.5"
                      >
                        {claim.evidence_result.confidence}% Confidence
                      </Badge>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Original Quote:</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed italic">
                    &quot;{claim.original_text_excerpt}&quot;
                  </p>
                </div>

                {claim.claim_checks && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3">
                        Language & Logic Analysis
                      </h4>
                      <div className="grid gap-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                          <div>
                            <p className="font-medium text-sm">
                              Logical Consistency
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {claim.claim_checks.logical_issue}
                            </p>
                          </div>
                          <Badge variant="default" className="font-semibold">
                            {Math.round(claim.claim_checks.logical_score * 100)}
                            %
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                          <div>
                            <p className="font-medium text-sm">
                              Tonality Check
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {claim.claim_checks.short_reason}
                            </p>
                          </div>
                          <Badge variant="default" className="font-semibold">
                            {Math.round(
                              (1 - claim.claim_checks.tonality_score) * 100
                            )}
                            %
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {claim.evidence_result ? (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Evidence Analysis
                      </h4>
                      <p className="text-sm leading-relaxed mb-4">
                        {claim.evidence_result.explanation}
                      </p>

                      {claim.evidence_result.supporting_evidence.length > 0 && (
                        <div className="space-y-3">
                          <h5 className="font-medium text-sm text-success">
                            Supporting Evidence:
                          </h5>
                          {claim.evidence_result.supporting_evidence.map(
                            (evidence, idx) => (
                              <div
                                key={idx}
                                className="space-y-2 p-3 rounded-lg border border-border/30 bg-green-400/30"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <h6 className="font-medium text-sm leading-tight">
                                    {evidence.title}
                                  </h6>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 shrink-0"
                                    asChild
                                  >
                                    <a
                                      href={evidence.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {evidence.snippet}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      )}

                      {claim.evidence_result.refuting_evidence.length > 0 && (
                        <div className="space-y-3">
                          <h5 className="font-medium text-sm text-success">
                            Refuting Evidence:
                          </h5>
                          {claim.evidence_result.refuting_evidence.map(
                            (evidence, idx) => (
                              <div
                                key={idx}
                                className="space-y-2 p-3 rounded-lg border border-border/30 bg-red-400/30"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <h6 className="font-medium text-sm leading-tight">
                                    {evidence.title}
                                  </h6>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 shrink-0"
                                    asChild
                                  >
                                    <a
                                      href={evidence.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {evidence.snippet}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : claim.evidence_checking ? (
                  <>
                    <Separator />
                    <div className="flex items-center justify-center p-6">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Clock className="h-5 w-5 animate-spin" />
                        <span>
                          Checking evidence... (this may take up to 10 seconds)
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  // show button for any claim that hasn't been checked yet and isn't already checking
                  !claim.evidence_result &&
                  !claim.evidence_checking && (
                    <>
                      <Separator />
                      <div className="flex justify-center">
                        <Button
                          onClick={() => handleEvidenceCheck(claim.id)}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Check for Evidence
                          <Badge variant="secondary" className="text-xs">
                            ~10s
                          </Badge>
                        </Button>
                      </div>
                    </>
                  )
                )}

                {claim.sources && claim.evidence_result && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Source Credibility Analysis
                      </h4>
                      <div className="grid gap-3">
                        {claim.sources.map((source, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
                          >
                            <div className="space-y-1">
                              <p className="font-medium text-sm">
                                {source.domain}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {source.rationale}
                              </p>
                              <div className="flex gap-1">
                                {source.trust_labels.map((label, labelIdx) => (
                                  <Badge
                                    key={labelIdx}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <Badge
                              variant={
                                getCredibilityColor(
                                  source.domain_cred_score
                                ) as any
                              }
                              className="font-semibold"
                            >
                              {Math.round(source.domain_cred_score * 100)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default FactChecker;
