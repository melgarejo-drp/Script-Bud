import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    // Allows custom logic if needed
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"],
};
