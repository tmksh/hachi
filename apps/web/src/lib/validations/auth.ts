import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(6, "パスワードは6文字以上で入力してください"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  display_name: z.string().min(1, "表示名は必須です"),
  department: z.string().optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
