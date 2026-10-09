// src/features/dashboard/components/analysis/summary-analysis.tsx

import { useMemo } from "react";
import { AssetData } from "../../../../types/dashboard";
import { IndicatorConfig } from "../../../../utils/financial";
import { scoreAssetSummary } from "../../lib/summary-scoring";
import {
    BrainCircuit, DollarSign, Shield, TrendingUp, Zap,
    ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle, Info,
    ArrowUpRight, ArrowDownRight, Minus, Sparkles
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import WinnerCard from "./summary/winner-card";
import CategoryLeaders from "./summary/category-leaders";
import RankingList from "./summary/ranking-list";

interface SummaryAnalysisProps {
    assets: AssetData[];
    indicatorConfig: IndicatorConfig;
}

interface AssetProfile {
    symbol: string;
    companyName: string;
    score: number;
    riskLevel: 'low' | 'medium' | 'high';
    recommendation: string;
    strengths: string[];
    weaknesses: string[];
    reasons: string[];
    sector: string;
    price: number;
    currency: string;
    changePercent: number;
    marketCap: number;
    coverage: number;
    trailingPE: number | null;
    forwardPE: number | null;
    forwardEPS: number | null;
    targetUpsidePct: number | null;
    verdict: 'positive' | 'neutral' | 'negative';
    verdictText: string;
}

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
    visible: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: { type: "spring", stiffness: 350, damping: 25 },
    },
};

function formatMarketCap(value: number): string {
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toFixed(0)}`;
}

function getVerdictConfig(verdict: 'positive' | 'neutral' | 'negative') {
    const configs = {
        positive: {
            icon: <ThumbsUp className="w-4 h-4" />,
            label: "Buena posición",
            className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
            barColor: "bg-emerald-500",
        },
        neutral: {
            icon: <Minus className="w-4 h-4" />,
            label: "Posición media",
            className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
            barColor: "bg-amber-500",
        },
        negative: {
            icon: <ThumbsDown className="w-4 h-4" />,
            label: "Requiere atención",
            className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
            barColor: "bg-red-500",
        },
    };
    return configs[verdict];
}

/** Panoramic Overview Card — the beginner-friendly summary */
function PanoramicOverview({ profiles, totalAssets }: { profiles: AssetProfile[]; totalAssets: number }) {
    const positiveCount = profiles.filter(p => p.verdict === 'positive').length;
    const neutralCount = profiles.filter(p => p.verdict === 'neutral').length;
    const negativeCount = profiles.filter(p => p.verdict === 'negative').length;

    const overallHealth = positiveCount > negativeCount ? 'good' : negativeCount > positiveCount ? 'poor' : 'mixed';
    const overallConfig = {
        good: { label: "Tu selección se ve sólida", icon: <CheckCircle className="w-5 h-5" />, color: "text-emerald-600 dark:text-emerald-400" },
        mixed: { label: "Tu selección es mixta", icon: <Info className="w-5 h-5" />, color: "text-amber-600 dark:text-amber-400" },
        poor: { label: "Tu selección necesita revisión", icon: <AlertTriangle className="w-5 h-5" />, color: "text-red-600 dark:text-red-400" },
    };
    const overall = overallConfig[overallHealth];

    return (
        <motion.div variants={itemVariants}>
            <Card className="border-primary/20 overflow-hidden">
                {/* Header with gradient accent */}
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
                    <CardHeader className="relative p-4 sm:p-6 pb-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg sm:text-xl heading-premium">Panorama General</CardTitle>
                                    <CardDescription className="text-xs sm:text-sm">
                                        Resumen inteligente de tus {totalAssets} activos seleccionados
                                    </CardDescription>
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 text-sm font-semibold ${overall.color}`}>
                                {overall.icon}
                                <span>{overall.label}</span>
                            </div>
                        </div>
                    </CardHeader>
                </div>

                <CardContent className="p-4 sm:p-6 pt-2 space-y-5">
                    {/* Health summary bar */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Distribución de salud de activos</span>
                            <span>{totalAssets} activos analizados</span>
                        </div>
                        <div className="flex h-3 rounded-full overflow-hidden bg-muted/50 gap-0.5">
                            {positiveCount > 0 && (
                                <motion.div
                                    className="bg-emerald-500 rounded-l-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(positiveCount / totalAssets) * 100}%` }}
                                    transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                />
                            )}
                            {neutralCount > 0 && (
                                <motion.div
                                    className="bg-amber-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(neutralCount / totalAssets) * 100}%` }}
                                    transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                />
                            )}
                            {negativeCount > 0 && (
                                <motion.div
                                    className="bg-red-500 rounded-r-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(negativeCount / totalAssets) * 100}%` }}
                                    transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
                                />
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                Bien ({positiveCount})
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                Regular ({neutralCount})
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                Débil ({negativeCount})
                            </span>
                        </div>
                    </div>

                    {/* Individual asset cards */}
                    <div className="space-y-3">
                        <AnimatePresence>
                            {profiles.map((profile, index) => {
                                const verdictConfig = getVerdictConfig(profile.verdict);
                                return (
                                    <motion.div
                                        key={profile.symbol}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 + index * 0.08, type: "spring", stiffness: 350, damping: 25 }}
                                        className="p-3 sm:p-4 rounded-xl border bg-card/50 hover:bg-card/80 transition-colors"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            {/* Asset identity */}
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-1 h-12 rounded-full shrink-0 ${verdictConfig.barColor}`} />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-base">{profile.symbol}</span>
                                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${verdictConfig.className}`}>
                                                            {verdictConfig.icon}
                                                            <span className="ml-1">{verdictConfig.label}</span>
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {profile.companyName} · {profile.sector}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Price & change */}
                                            <div className="flex items-center gap-4 shrink-0 pl-4 sm:pl-0">
                                                <div className="text-right">
                                                    <div className="font-bold text-sm tabular-nums">${profile.price.toFixed(2)}</div>
                                                    <div className={`flex items-center gap-0.5 text-xs font-medium ${profile.changePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {profile.changePercent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                        {Math.abs(profile.changePercent).toFixed(2)}%
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-muted-foreground">Cap.</div>
                                                    <div className="text-xs font-semibold">{formatMarketCap(profile.marketCap)}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-muted-foreground">Score</div>
                                                    <div className="text-sm font-bold text-primary tabular-nums">{profile.score}<span className="text-[10px] text-muted-foreground">/100</span></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2 text-xs sm:grid-cols-4">
                                            <div><span className="text-muted-foreground">PER / forward</span><div className="font-semibold tabular-nums">{profile.trailingPE?.toFixed(2) ?? 'N/D'} / {profile.forwardPE?.toFixed(2) ?? 'N/D'}</div></div>
                                            <div><span className="text-muted-foreground">EPS forward</span><div className="font-semibold tabular-nums">{profile.forwardEPS !== null ? `${profile.forwardEPS.toFixed(2)} ${profile.currency}` : 'N/D'}</div></div>
                                            <div><span className="text-muted-foreground">Potencial objetivo</span><div className="font-semibold tabular-nums">{profile.targetUpsidePct !== null ? `${profile.targetUpsidePct > 0 ? '+' : ''}${profile.targetUpsidePct.toFixed(1)}%` : 'N/D'}</div></div>
                                            <div><span className="text-muted-foreground">Cobertura</span><div className="font-semibold tabular-nums">{profile.coverage}% de señales disponibles</div></div>
                                        </div>

                                        {/* Verdict explanation */}
                                        <div className="mt-3 pt-3 border-t border-dashed">
                                            <p className="text-xs text-foreground/70 leading-relaxed italic">
                                                "{profile.verdictText}"
                                            </p>
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {profile.strengths.map((s, i) => (
                                                    <Badge key={`s-${i}`} variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                                                        <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                                                        {s}
                                                    </Badge>
                                                ))}
                                                {profile.weaknesses.map((w, i) => (
                                                    <Badge key={`w-${i}`} variant="secondary" className="text-[10px] bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
                                                        <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                                        {w}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <details className="mt-3 text-xs">
                                                <summary className="cursor-pointer font-medium text-primary">Ver señales consideradas ({profile.reasons.length})</summary>
                                                <ul className="mt-2 space-y-1.5 pl-4 text-muted-foreground">
                                                    {profile.reasons.map((reason, reasonIndex) => (
                                                        <li key={`${profile.symbol}-reason-${reasonIndex}`} className="list-disc">{reason}</li>
                                                    ))}
                                                </ul>
                                            </details>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

export default function SummaryAnalysis({ assets, indicatorConfig }: SummaryAnalysisProps) {
    const fallbackAssets = useMemo(
        () => assets.filter(asset => asset.dataSource === 'Yahoo Finance'),
        [assets],
    );
    const analysisAssets = useMemo(
        () => assets.filter((asset) =>
            asset.dataSource !== 'Yahoo Finance' || scoreAssetSummary(asset).coverage > 0
        ),
        [assets],
    );
    const yahooPartialAssets = useMemo(
        () => assets.filter((asset) => Boolean(asset.yahooError)),
        [assets],
    );

    const analysis = useMemo(() => {
        if (analysisAssets.length < 1) return null;

        const categories = {
            valuation: {
                label: "Valoración",
                metrics: ['PER', 'forwardPER', 'evToEbitda', 'priceToBook', 'pfc_ratio'],
                weight: 0.3,
                icon: <DollarSign className="w-5 h-5" />
            },
            profitability: {
                label: "Calidad y Rentabilidad",
                metrics: ['roe', 'roic', 'operatingMargin', 'grossMargin'],
                weight: 0.3,
                icon: <TrendingUp className="w-5 h-5" />
            },
            financial_health: {
                label: "Salud Financiera",
                metrics: ['netDebtToEBITDA', 'currentRatio'],
                weight: 0.2,
                icon: <Shield className="w-5 h-5" />
            },
            momentum: {
                label: "Potencial y Momento",
                metrics: ['upsidePotential', 'relativeVolume'],
                weight: 0.2,
                icon: <Zap className="w-5 h-5" />
            }
        };

        const scored = analysisAssets.map((asset) => ({
            asset,
            summary: scoreAssetSummary(asset),
        }));
        const rankedAssets = scored
            .map(({ asset, summary }) => ({
                asset,
                score: summary.score,
                details: summary.categoryScores,
            }))
            .sort((left, right) => right.score - left.score);

        const categoryWinners: Record<string, { symbol: string; score: number; metrics: string[] }> = {};
        Object.keys(categories).forEach(catKey => {
            let winner = rankedAssets[0];
            let maxVal = -1;
            rankedAssets.forEach(item => {
                const catScore = item.details[catKey as keyof typeof item.details] || 0;
                if (catScore > maxVal) {
                    maxVal = catScore;
                    winner = item;
                }
            });
            categoryWinners[catKey] = {
                symbol: winner.asset.profile.symbol,
                score: Math.round(maxVal),
                metrics: categories[catKey as keyof typeof categories].metrics
            };
        });

        const assetProfiles: AssetProfile[] = scored.map(({ asset, summary }) => {
            const latestRatio = [...asset.ratios].sort((left, right) => Date.parse(right.date) - Date.parse(left.date))[0];
            const debt = latestRatio?.debtToEquityRatio;
            const beta = asset.profile.beta;
            const riskLevel: AssetProfile['riskLevel'] =
                (typeof debt === 'number' && debt > 2.5) || beta > 1.8
                    ? 'high'
                    : typeof debt === 'number' && debt < 0.8 && beta < 1.1
                        ? 'low'
                        : 'medium';
            const price = asset.quote?.price ?? 0;
            const target = asset.priceTargetConsensus?.targetConsensus ?? 0;

            return {
                symbol: asset.profile.symbol,
                companyName: asset.profile.companyName,
                score: summary.score,
                riskLevel,
                recommendation: summary.verdictText,
                strengths: summary.strengths,
                weaknesses: summary.weaknesses,
                reasons: summary.reasons,
                sector: asset.profile.sector || 'N/A',
                price,
                currency: asset.profile.currency || 'USD',
                changePercent: asset.quote?.changePercentage ?? asset.profile.changePercentage ?? 0,
                marketCap: asset.quote?.marketCap ?? asset.profile.marketCap ?? 0,
                coverage: summary.coverage,
                trailingPE: asset.quote?.pe && asset.quote.pe > 0 ? asset.quote.pe : null,
                forwardPE: asset.quote?.forwardPE && asset.quote.forwardPE > 0 ? asset.quote.forwardPE : null,
                forwardEPS: asset.quote?.forwardEPS && asset.quote.forwardEPS > 0 ? asset.quote.forwardEPS : null,
                targetUpsidePct: price > 0 && target > 0 ? ((target / price) - 1) * 100 : null,
                verdict: summary.verdict,
                verdictText: summary.verdictText,
            };
        });

        return { rankedAssets, categoryWinners, categories, assetProfiles };

    }, [analysisAssets]);

    // Empty / single state — still show the panoramic view for a single asset
    if (!analysis) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center gap-2 sm:gap-3 p-4 sm:p-6">
                    <BrainCircuit className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    <div>
                        <CardTitle className="text-lg sm:text-xl">Resumen Inteligente</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Panorama completo de tus activos</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground py-8 sm:py-10 px-4 text-sm sm:text-base">
                    {fallbackAssets.length > 0 ? (
                        <div className="space-y-2">
                            <p>
                                FMP no respondió para {fallbackAssets.map(asset => asset.profile.symbol).join(', ')}.
                                Se muestran cotizaciones y métricas forward de Yahoo Finance, pero no se los incluye
                                en el ranking fundamental porque Yahoo no entregó el resto de las métricas necesarias.
                            </p>
                            {fallbackAssets.map(asset => (
                                <p key={asset.profile.symbol} className="font-medium">
                                    {asset.profile.symbol}: {asset.profile.companyName} · {asset.profile.currency}{' '}
                                    {asset.quote.price.toFixed(2)} · PER {asset.quote.pe && asset.quote.pe > 0
                                        ? asset.quote.pe.toFixed(2)
                                        : 'No disponible'} · PER forward {asset.quote.forwardPE && asset.quote.forwardPE > 0
                                        ? asset.quote.forwardPE.toFixed(2)
                                        : 'No disponible'} · EPS forward {asset.quote.forwardEPS && asset.quote.forwardEPS > 0
                                        ? asset.quote.forwardEPS.toFixed(2)
                                        : 'No disponible'} · Objetivo {asset.priceTargetConsensus.targetConsensus > 0
                                        ? `${asset.profile.currency} ${asset.priceTargetConsensus.targetConsensus.toFixed(2)}`
                                        : 'No disponible'}
                                </p>
                            ))}
                        </div>
                    ) : (
                        <p>Selecciona al menos un activo para generar el análisis inteligente.</p>
                    )}
                </CardContent>
            </Card>
        );
    }

    const winner = analysis.rankedAssets[0];
    const winnerProfile = analysis.assetProfiles.find(p => p.symbol === winner.asset.profile.symbol);

    if (!winnerProfile) return null;

    return (
        <motion.section
            className="space-y-4 sm:space-y-5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {fallbackAssets.length > 0 && (
                <Card className="border-amber-500/30">
                    <CardContent className="p-4 text-sm text-muted-foreground">
                        FMP no respondió para {fallbackAssets.map(asset => asset.profile.symbol).join(', ')}.
                        Se incorporan al análisis solo las señales que Yahoo Finance sí entregó;
                        la cobertura se indica para no presentar métricas faltantes como certezas.
                    </CardContent>
                </Card>
            )}
            {yahooPartialAssets.length > 0 && (
                <Card className="border-amber-500/30">
                    <CardContent className="p-4 text-sm text-muted-foreground">
                        Yahoo Finance entregó datos parciales para{' '}
                        {yahooPartialAssets.map((asset) => asset.profile.symbol).join(', ')}.
                        Las cotizaciones e indicadores disponibles se usan; algunas métricas fundamentales pueden faltar.
                    </CardContent>
                </Card>
            )}
            {/* 1. Panoramic Overview — THE main beginner-friendly section */}
            <PanoramicOverview
                profiles={analysis.assetProfiles}
                totalAssets={analysisAssets.length}
            />

            {/* 2. Winner card — only when there are 2+ assets to compare */}
            {analysisAssets.length >= 2 && (
                <motion.div variants={itemVariants}>
                    <WinnerCard
                        symbol={winner.asset.profile.symbol}
                        companyName={winner.asset.profile.companyName}
                        score={winner.score}
                        recommendation={winnerProfile.recommendation}
                        riskLevel={winnerProfile.riskLevel}
                        strengths={winnerProfile.strengths}
                        totalMetrics={Object.values(analysis.categories).reduce((acc, cat) => acc + cat.metrics.length, 0)}
                    />
                </motion.div>
            )}

            {/* 3. Category Leaders + Ranking — only when there are 2+ assets */}
            {analysisAssets.length >= 2 && (
                <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    <CategoryLeaders
                        categoryWinners={analysis.categoryWinners}
                        categories={analysis.categories}
                        assets={analysisAssets}
                        indicatorConfig={indicatorConfig}
                    />
                    <RankingList rankedAssets={analysis.rankedAssets} />
                </motion.div>
            )}
        </motion.section>
    );
}