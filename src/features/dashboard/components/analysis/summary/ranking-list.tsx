import { Award, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { AssetData } from "../../../../../types/dashboard";
import { motion } from "framer-motion";

interface RankingListProps {
    // El objeto 'asset' dentro del array es de tipo AssetData completo
    rankedAssets: { asset: AssetData; score: number }[];
}

export default function RankingList({ rankedAssets }: RankingListProps) {
    return (
        <Card className="h-full">
            <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Ranking General
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                    Clasificación ponderada (Valor + Calidad + Salud + Potencial)
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
                <div className="space-y-2">
                    {rankedAssets.map((item, index) => {
                        const isWinner = index === 0;
                        return (
                            <motion.div
                                key={item.asset.profile.symbol}
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                    delay: index * 0.07,
                                    type: "spring",
                                    stiffness: 350,
                                    damping: 25,
                                }}
                                whileHover={{ scale: 1.01, x: 4 }}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-default ${isWinner
                                        ? 'border-primary/50 bg-primary/5 shadow-sm'
                                        : 'hover:bg-muted/40 hover:border-muted-foreground/20'
                                    }`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shrink-0 ${isWinner
                                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/20'
                                            : 'bg-muted text-muted-foreground'
                                        }`}>
                                        {isWinner ? <Trophy className="w-4 h-4" /> : index + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm truncate">
                                            {item.asset.profile.symbol}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-[180px]">
                                            {item.asset.profile.companyName}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right shrink-0 pl-2">
                                    <motion.div
                                        className="text-lg font-bold text-primary tabular-nums"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.3 + index * 0.07 }}
                                    >
                                        {item.score}
                                    </motion.div>
                                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                        Puntos
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}