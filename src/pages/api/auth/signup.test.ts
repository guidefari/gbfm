// this is letting empty strings through. fix

const validatedUser = usernameSchema.safeParse(username)
const validatedEmail = emailSchema.safeParse(email)

if (username && !validatedUser.success) {
  return res.status(400).json({
    message: "Invalid username",
  })
}