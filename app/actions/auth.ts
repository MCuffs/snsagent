'use server'

import { getSessionUser as getCurrentSessionUser } from '../../lib/auth/user'
import {
  loginAction as runLoginAction,
  registerAction as runRegisterAction,
  loginWithPasswordAction as runLoginWithPasswordAction,
  logoutAction as runLogoutAction,
} from '../auth-actions'

export async function getSessionUser() {
  return getCurrentSessionUser()
}

export async function loginAction(email: string, name?: string) {
  return runLoginAction(email, name)
}

export async function registerAction(email: string, password: string, name?: string) {
  return runRegisterAction(email, password, name)
}

export async function loginWithPasswordAction(email: string, password: string) {
  return runLoginWithPasswordAction(email, password)
}

export async function logoutAction() {
  return runLogoutAction()
}
