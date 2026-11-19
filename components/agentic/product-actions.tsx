"use client"

import { createContext, useContext } from "react"

type ProductActions = {
  navigate?: (key: string) => void
  create?: () => void
}

const ProductActionsContext = createContext<ProductActions>({})

export function ProductActionsProvider({
  value,
  children,
}: {
  value: ProductActions
  children: React.ReactNode
}) {
  return <ProductActionsContext.Provider value={value}>{children}</ProductActionsContext.Provider>
}

export function useProductActions(): ProductActions {
  return useContext(ProductActionsContext)
}
