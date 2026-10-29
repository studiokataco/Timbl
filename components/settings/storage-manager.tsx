"use client"

import { GoogleDriveIcon } from "@/components/marketing/brand-icons"
import { ListPanel } from "@/components/shared/list-panel"
import { ConnectionRow, LogoTile } from "@/components/settings/integrations-bits"
import { disconnectStorageAccount } from "@/lib/actions/storage-accounts"
import { STORAGE_PROVIDERS } from "@/lib/storage/providers"
import { faviconUrl } from "@/lib/url"
import type { WithId } from "@/lib/firebase/serialize"
import type { StorageProvider } from "@/lib/schemas/_shared"
import type { StorageAccountPublic } from "@/lib/schemas"

type Account = WithId<StorageAccountPublic>

type Props = {
  accounts: Account[]
  availableProviders: StorageProvider[]
}

export function StorageManager({ accounts, availableProviders }: Props) {
  const available = new Set(availableProviders)

  return (
    <ListPanel>
      <ul className="divide-y divide-border">
        {STORAGE_PROVIDERS.map((p) => (
          <ConnectionRow
            key={p.key}
            name={p.label}
            leading={
              <LogoTile>
                {p.key === "gdrive" ? (
                  <GoogleDriveIcon aria-hidden />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={faviconUrl(`https://${p.domain}`)} alt="" className="rounded-sm" />
                )}
              </LogoTile>
            }
            accounts={accounts.filter((a) => a.provider === p.key)}
            connectHref={available.has(p.key) ? `/api/storage/${p.key}/connect` : null}
            idleHint={`Attach ${p.label} files to posts`}
            blockedHint="Not available yet"
            disconnect={disconnectStorageAccount}
            disconnectNote={`Your team can't attach files from this ${p.label} account until it's connected again.`}
          />
        ))}
      </ul>
    </ListPanel>
  )
}
