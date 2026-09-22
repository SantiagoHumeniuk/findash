import { Award, CheckCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Badge } from "../../../../../components/ui/badge";
import { motion } from "framer-motion";

interface WinnerCardProps {
    symbol: string;
    companyName: string;
    score: number;
    recommendation: string;
    riskLevel: 'low' | 'medium' | 'high';
    strengths: string[];
    totalMetrics: number;
}

const getRiskBadge = (risk: 'low' | 'medium' | 'high') => {
    const styles = {
        low: { className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20', label: 'Bajo Riesgo', icon: <CheckCircle className="w-3 h-3 mr-1" /> },
        medium: { className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20', label: 'Riesgo Moderado', icon: <TrendingUp className="w-3 h-3 mr-1" /> },
        high: { className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20', label: 'Alto Riesgo', icon: <AlertTriangle className="w-3 h-3 mr-1" /> }
    };
    return styles[risk];
};

export default function WinnerCard({ symbol, companyName, score, recommendation, riskLevel, strengths, totalMetrics }: WinnerCardProps) {
    const riskConfig = getRiskBadge(riskLevel);

    return (
        <Card className="border-primary/20 bg-primary/5 overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <motion.div
                            className="p-2 bg-primary/10 rounded-full"
                            initial={{ rotate: -30, scale: 0 }}
                            animate={{ rotate: 0, scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
                        >
                            <Award className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                        </motion.div>
                        <div>
                            <CardTitle className="text-lg sm:text-xl">Activo Destacado</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                Análisis integral sobre {totalMetrics} métricas clave
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant="outline" className={`text-xs pl-1 pr-2 py-0.5 ${riskConfig.className}`}>
                        {riskConfig.icon}
                        {riskConfig.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-2">
                <motion.div
                    className="bg-background/60 backdrop-blur-sm p-4 rounded-lg border shadow-sm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-xl sm:text-2xl text-primary flex items-center gap-2">
                                {symbol}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                                {companyName}
                            </p>
                        </div>
                        <div className="text-right">
                            <motion.span
                                className="text-2xl font-bold"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 15 }}
                            >
                                {score}
                            </motion.span>
                            <span className="text-xs text-muted-foreground">/100</span>
                        </div>
                    </div>

                    <p className="text-sm text-foreground/80 italic mb-4 leading-relaxed border-l-2 border-primary/30 pl-3">
                        "{recommendation}"
                    </p>

                    {strengths && strengths.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {strengths.map((str, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.6 + i * 0.1 }}
                                >
                                    <Badge variant="secondary" className="text-[10px] sm:text-xs bg-primary/10 text-primary hover:bg-primary/20">
                                        {str}
                                    </Badge>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </CardContent>
        </Card>
    );
}