// src/features/dashboard/components/analysis/summary-analysis.tsx

import { useMemo } from "react";
import { AssetData } from "../../../../types/dashboard";
import { IndicatorConfig, indicatorConfig as globalIndicatorConfig } from "../../../../utils/financial";
import {
    BrainCircuit, DollarSign, Shield, TrendingUp, Zap,
    ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle, Info,
    ArrowUpRight, ArrowDownRight, Minus, Sparkles
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
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
    sector: string;
    price: number;
    changePercent: number;
    marketCap: number;
    verdict: 'positive' | 'neutral' | 'negative';
    verdictText: string;
}

// Función Helper para resolver valores
const resolveValue = (asset: AssetData, key: string): number | null => {
    if (key === 'upsidePotential') {
        const p = asset.quote?.price;
        const t = asset.priceTargetConsensus?.targetConsensus;
        return (p && t && p > 0) ? (t - p) / p : null;
    }

    const config = globalIndicatorConfig[key];
    if (!config) return null;

    let value: number | null = null;
    const sources = [asset.keyMetrics, asset.profile, asset.quote];

    for (const field of config.apiFields) {
        for (const source of sources) {
            if (source && typeof source === 'object' && field in source) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const val = (source as any)[field];
                if (typeof val === 'number' && Number.isFinite(val)) {
                    value = val;
                    break;
                }
            }
        }
        if (value !== null) break;
    }

    if (value === null && config.compute) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawContext: any = {
            ...(asset.profile as any), // eslint-disable-line @typescript-eslint/no-explicit-any
            ...(asset.quote as any), // eslint-disable-line @typescript-eslint/no-explicit-any
            ...(asset.keyMetrics as any), // eslint-disable-line @typescript-eslint/no-explicit-any
        };
        const computed = config.compute(rawContext);
        if (computed !== null && Number.isFinite(computed)) value = computed;
    }

    return value;
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
};

const itemVariants = {
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

    const analysis = useMemo(() => {
        if (assets.length < 1) return null;

        const categories = {
            valuation: {
                label: "Valoración",
                metrics: ['PER', 'evToEbitda', 'priceToBook', 'pfc_ratio'],
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

        const scores: Record<string, Record<string, number>> = {};

        assets.forEach(a => {
            scores[a.profile.symbol] = {};
        });

        // Calcular puntajes por categoría
        Object.entries(categories).forEach(([catKey, category]) => {
            category.metrics.forEach(metric => {
                const validAssets = assets.map(a => ({
                    symbol: a.profile.symbol,
                    value: resolveValue(a, metric)
                })).filter(item => item.value !== null) as { symbol: string, value: number }[];

                if (validAssets.length < 1) return;

                let lowerIsBetter = false;
                if (metric === 'upsidePotential') lowerIsBetter = false;
                else lowerIsBetter = indicatorConfig[metric]?.lowerIsBetter ?? false;

                validAssets.sort((a, b) => lowerIsBetter ? a.value - b.value : b.value - a.value);

                validAssets.forEach((item, index) => {
                    const points = validAssets.length === 1
                        ? 5 // Single asset gets a neutral score
                        : ((validAssets.length - 1 - index) / Math.max(1, validAssets.length - 1)) * 10;
                    if (!scores[item.symbol][catKey]) scores[item.symbol][catKey] = 0;
                    scores[item.symbol][catKey] += points;
                });
            });

            // Normalizar a escala 0-100 por categoría
            assets.forEach(a => {
                const rawScore = scores[a.profile.symbol][catKey] || 0;
                scores[a.profile.symbol][catKey] = (rawScore / Math.max(1, category.metrics.length)) * 10;
            });
        });

        const rankedAssets = assets.map(asset => {
            const s = scores[asset.profile.symbol];

            let totalWeighted =
                (s.valuation || 0) * categories.valuation.weight +
                (s.profitability || 0) * categories.profitability.weight +
                (s.financial_health || 0) * categories.financial_health.weight +
                (s.momentum || 0) * categories.momentum.weight;

            totalWeighted = Math.round(totalWeighted);

            return { asset, score: totalWeighted, details: s };
        }).sort((a, b) => b.score - a.score);

        const categoryWinners: Record<string, { symbol: string; score: number; metrics: string[] }> = {};
        Object.keys(categories).forEach(catKey => {
            let winner = rankedAssets[0];
            let maxVal = -1;
            rankedAssets.forEach(item => {
                const catScore = item.details[catKey] || 0;
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

        const assetProfiles: AssetProfile[] = rankedAssets.map(item => {
            const { asset, score, details } = item;

            const debt = resolveValue(asset, 'debtToEquity') ?? 999;
            const beta = resolveValue(asset, 'beta') ?? 1;

            let riskLevel: 'low' | 'medium' | 'high' = 'medium';
            if (debt < 0.8 && beta < 1.1) riskLevel = 'low';
            else if (debt > 2.0 || beta > 1.5) riskLevel = 'high';

            const strengths: string[] = [];
            const weaknesses: string[] = [];

            if ((details.valuation || 0) > 60) strengths.push("Valoración Atractiva");
            if ((details.profitability || 0) > 60) strengths.push("Alta Calidad");
            if ((details.financial_health || 0) > 60) strengths.push("Balance Sólido");
            if ((details.momentum || 0) > 60) strengths.push("Alto Potencial");

            if ((details.valuation || 0) < 30) weaknesses.push("Valoración Exigente");
            if ((details.financial_health || 0) < 30) weaknesses.push("Riesgo Financiero");
            if ((details.profitability || 0) < 30) weaknesses.push("Rentabilidad Baja");
            if ((details.momentum || 0) < 30) weaknesses.push("Poco Potencial");

            let verdict: 'positive' | 'neutral' | 'negative' = 'neutral';
            let verdictText = "";

            if (score >= 60) {
                verdict = 'positive';
                verdictText = `${asset.profile.companyName} muestra fundamentos sólidos. Destaca en ${strengths.slice(0, 2).join(' y ').toLowerCase() || 'métricas generales'}. Es una opción interesante para considerar.`;
            } else if (score >= 35) {
                verdict = 'neutral';
                verdictText = `${asset.profile.companyName} tiene un desempeño mixto. ${strengths.length > 0 ? `Punto fuerte: ${strengths[0].toLowerCase()}.` : ''} ${weaknesses.length > 0 ? `Punto débil: ${weaknesses[0].toLowerCase()}.` : ''} Conviene investigar más antes de decidir.`;
            } else {
                verdict = 'negative';
                verdictText = `${asset.profile.companyName} presenta señales de alerta. ${weaknesses.length > 0 ? `Principalmente ${weaknesses.join(' y ').toLowerCase()}.` : 'Sus métricas están por debajo del promedio.'} Se recomienda precaución.`;
            }

            let recommendation = "";
            if (score >= 80) recommendation = "Excelente opción integral. Destaca por su equilibrio.";
            else if (score >= 60) recommendation = "Opción sólida. Buen desempeño general.";
            else if (score >= 40) recommendation = "Desempeño medio. Evaluar estrategia.";
            else recommendation = "Puntaje bajo comparativo. Revisar fundamentales.";

            return {
                symbol: asset.profile.symbol,
                companyName: asset.profile.companyName,
                score,
                riskLevel,
                recommendation,
                strengths,
                weaknesses,
                sector: asset.profile.sector || 'N/A',
                price: asset.quote?.price || asset.profile.price || 0,
                changePercent: asset.quote?.changePercentage || asset.profile.changePercentage || 0,
                marketCap: asset.quote?.marketCap || asset.profile.marketCap || 0,
                verdict,
                verdictText,
            };
        });

        return { rankedAssets, categoryWinners, categories, assetProfiles };

    }, [assets, indicatorConfig]);

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
                    <p>Selecciona al menos un activo para generar el análisis inteligente.</p>
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
            {/* 1. Panoramic Overview — THE main beginner-friendly section */}
            <PanoramicOverview
                profiles={analysis.assetProfiles}
                totalAssets={assets.length}
            />

            {/* 2. Winner card — only when there are 2+ assets to compare */}
            {assets.length >= 2 && (
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
            {assets.length >= 2 && (
                <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    <CategoryLeaders
                        categoryWinners={analysis.categoryWinners}
                        categories={analysis.categories}
                        assets={assets}
                        indicatorConfig={indicatorConfig}
                    />
                    <RankingList rankedAssets={analysis.rankedAssets} />
                </motion.div>
            )}
        </motion.section>
    );
}