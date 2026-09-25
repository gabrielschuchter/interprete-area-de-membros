import { SignIn as ClerkSignIn } from "@clerk/nextjs";
import { interpreteAuthAppearance } from "../appearance";

export const SignIn = () => (
  <ClerkSignIn
    appearance={{
      ...interpreteAuthAppearance,
      elements: {
        ...interpreteAuthAppearance.elements,
        header: "hidden",
        card: "border-0 bg-transparent p-0 shadow-none",
      },
    }}
  />
);
