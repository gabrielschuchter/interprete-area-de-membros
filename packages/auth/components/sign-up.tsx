import { SignUp as ClerkSignUp } from "@clerk/nextjs";
import { interpreteAuthAppearance } from "../appearance";

export const SignUp = () => (
  <ClerkSignUp
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
