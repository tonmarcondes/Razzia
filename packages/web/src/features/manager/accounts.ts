import { api, unwrap, unwrapEmpty } from "@razzia/web/lib/api"
import { queryOptions } from "@tanstack/react-query"
import type { z } from "zod"
import type {
  createAccountValidator,
  updateAccountValidator,
} from "@razzia/common/validators/accounts"

export const authConfigQuery = () =>
  queryOptions({
    queryKey: ["auth-config"],
    queryFn: () => unwrap(api.auth.config.$get()),
  })

export const accountQuery = () =>
  queryOptions({
    queryKey: ["current-account"],
    queryFn: () => unwrap(api.auth.me.$get()),
    retry: false,
  })

export const usersQuery = () =>
  queryOptions({ queryKey: ["users"], queryFn: () => unwrap(api.users.$get()) })

export const loginAccount = (json: { login: string; password: string }) =>
  unwrap(api.auth.login.$post({ json }))

export const changePassword = (json: {
  currentPassword: string
  password: string
}) => unwrap(api.auth.password.$post({ json }))

export const createAccount = (json: z.infer<typeof createAccountValidator>) =>
  unwrap(api.users.$post({ json }))

export const updateAccount = (
  id: string,
  json: z.infer<typeof updateAccountValidator>,
) => unwrap(api.users[":id"].$patch({ param: { id }, json }))

export const resetAccount = (id: string, password: string) =>
  unwrapEmpty(
    api.users[":id"].reset.$post({ param: { id }, json: { password } }),
  )
