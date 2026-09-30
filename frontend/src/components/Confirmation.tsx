export function Confirmation({ email }: { email: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <h2>Thank you</h2>
      <p>
        Your KYC/CDD submission has been received. A copy has been emailed to <span>{email}</span>.
      </p>
    </div>
  );
}
