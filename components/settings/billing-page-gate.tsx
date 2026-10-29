import { FormGroupTitle, FormRow } from "@/components/shared/form-row"

export function BillingPageGate({ planLabel }: { planLabel: string }) {
  return (
    <>
      <FormGroupTitle>Plan</FormGroupTitle>
      <div className="mt-2">
        <FormRow title="Current plan" hint="What this workspace is on today.">
          <p className="text-[14px] font-medium text-foreground">{planLabel}</p>
        </FormRow>
        <FormRow title="Plan changes" hint="Upgrades, trials and checkout.">
          <p className="text-[14px] font-medium text-foreground">Not open yet</p>
          <p className="mt-0.5 max-w-[60ch] text-[13px] text-muted-foreground">
            Your workspace keeps working as usual. We will announce it when self-serve billing goes
            live.
          </p>
        </FormRow>
      </div>
    </>
  )
}
