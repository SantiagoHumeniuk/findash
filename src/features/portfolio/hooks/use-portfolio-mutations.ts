// src/features/portfolio/hooks/use-portfolio-mutations.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-auth';
import { Transaction, Portfolio } from '../../../types/portfolio';
import { AssetData } from '../../../types/dashboard';
import { logger } from '../../../lib/logger';

interface PortfolioQueryData {
    transactions: Transaction[];
    portfolioData: Record<string, AssetData>;
    portfolios: Portfolio[];
}

/**
 * Función que realmente inserta la nueva transacción en la base de datos.
 * @param {Omit<Transaction, 'id' | 'user_id'> & { userId: string }} newTransaction - La transacción a añadir.
 * @returns La transacción creada.
 */
async function addTransactionToDb(newTransaction: Omit<Transaction, 'id' | 'user_id'> & { userId: string }) {
    const { userId, ...transactionData } = newTransaction;
    const result = await supabase
        .from('transactions')
        .insert({ ...transactionData, user_id: userId })
        .select()
        .single(); // Esperamos que devuelva un solo objeto

    if (result.error) {
        throw new Error(result.error.message);
    }
    return result.data as Transaction;
}

/**
 * Hook que proporciona mutaciones para gestionar el portafolio con actualizaciones optimistas.
 * @returns Un objeto con la mutación `addTransaction`.
 */
export function usePortfolioMutations() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const addTransactionMutation = useMutation<
        Transaction, // Tipo de dato que devuelve la mutación
        Error, // Tipo del error
        Omit<Transaction, 'id' | 'user_id'> & { userId: string }, // Tipo de las variables que recibe `mutate`
        { previousPortfolio?: PortfolioQueryData } // Tipo del contexto
    >({
        mutationFn: addTransactionToDb,

        // ✅ Aquí ocurre la magia optimista
        onMutate: async (newTransactionData) => {
            const queryKey = ['portfolio', user?.id];

            // 1. Cancelamos cualquier refetch en curso para que no sobreescriba nuestra actualización optimista.
            await queryClient.cancelQueries({ queryKey });

            // 2. Guardamos una "instantánea" del estado actual por si algo sale mal.
            const previousPortfolio = queryClient.getQueryData<PortfolioQueryData>(queryKey);

            // 3. Actualizamos el caché de React Query de forma optimista.
            queryClient.setQueryData<PortfolioQueryData>(queryKey, (oldData) => {
                const newTransaction: Transaction = {
                    ...newTransactionData,
                    id: Date.now(), // ID temporal optimista
                    user_id: user!.id,
                };

                // Añadimos la nueva transacción a la lista existente.
                const updatedTransactions: Transaction[] = [newTransaction, ...(oldData?.transactions ?? [])];

                return {
                    transactions: updatedTransactions,
                    portfolioData: oldData?.portfolioData ?? {},
                    portfolios: oldData?.portfolios ?? [],
                };
            });

            // 4. Devolvemos la "instantánea" para poder restaurarla en caso de error.
            return { previousPortfolio };
        },

        // Si la mutación falla, usamos el contexto de onMutate para revertir el cambio.
        onError: (err, variables, context) => {
            if (context?.previousPortfolio) {
                // The caller reports the error; here the optimistic row is only undone.
                queryClient.setQueryData(['portfolio', user?.id], context.previousPortfolio);
                void logger.error('ADD_TRANSACTION_FAILED', err.message, { variables });
            }
        },

        // Se ejecuta siempre al final, ya sea con éxito o error.
        onSettled: () => {
            // 5. Invalidamos la query del portafolio. Esto le dice a React Query que los datos
            // están "sucios" y que debe volver a pedirlos al servidor para obtener la versión final y verdadera.
            void queryClient.invalidateQueries({ queryKey: ['portfolio', user?.id] });
        },
    });

    return { addTransaction: addTransactionMutation };
}