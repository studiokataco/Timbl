import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Timbl - AI Social Media Planner"

const BARS = [
  ["#00E89A", "#161624", "#FF5040"],
  ["#161624", "#7B5EFF", "#161624"],
]

const CHIPS = ["#fb923c", "#ec4899", "#8b5cf6", "#34d399", "#3b82f6"]

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          gap: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 120,
              height: 120,
              borderRadius: 26,
              backgroundColor: "#090A12",
              padding: 22,
              justifyContent: "space-between",
            }}
          >
            {BARS.map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                {row.map((fill, j) => (
                  <div
                    key={j}
                    style={{
                      width: 16,
                      height: 30,
                      borderRadius: 5,
                      backgroundColor: fill,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: 132,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#111111",
            }}
          >
            timbl
          </div>
        </div>
        <div style={{ fontSize: 38, color: "#6b7280" }}>
          The AI social media planner for marketers and creators
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {CHIPS.map((fill) => (
            <div
              key={fill}
              style={{
                width: 44,
                height: 12,
                borderRadius: 999,
                backgroundColor: fill,
              }}
            />
          ))}
        </div>
      </div>
    ),
    size
  )
}
