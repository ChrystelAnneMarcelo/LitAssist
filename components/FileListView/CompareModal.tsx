"use client";

import { useState } from "react";
import {
  GitCompare,
  X,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Paper } from "@/types";
import styles from "./styles.module.css";

interface CompareModalProps {
  papers: Paper[];
  onClose: () => void;
}

const DIMENSIONS = [
  { key: "Research Objective", icon: "🎯" },
  { key: "Methodology", icon: "🔬" },
  { key: "Sample / Dataset", icon: "📊" },
  { key: "Key Findings", icon: "💡" },
  { key: "Limitations", icon: "⚠️" },
  { key: "Relevance", icon: "🔗" },
];

const MOCK_DATA: Record<string, string[]> = {
  "Research Objective": [
    "Detect tomato peduncles for robotic harvesting using improved YOLOv5.",
    "Estimate ginger shoot orientation for automated transplanting systems.",
    "Synthesize deep learning evidence for plant disease identification (142 studies).",
    "Classify trace-element deficiencies in lettuce via hyperspectral imaging.",
    "Survey transformer-based and self-supervised models for disease classification.",
    "Deploy a quantized lightweight model for edge inference in agricultural IoT.",
    "Enable selective leafy-vegetable transplanting with a dual-arm robot system.",
    "Optimize energy-efficient plant disease detection for Raspberry Pi deployment.",
  ],
  Methodology: [
    "YOLOv5 fine-tuned on 3,200 annotated tomato images; transfer learning from COCO.",
    "RGB-D camera + CNN + point cloud fusion; 1,800 seedling samples.",
    "PRISMA systematic review; 142 studies; NVivo thematic coding.",
    "Hyperspectral imaging (400–1000 nm) + DenseNet-121; 5-fold CV; 4,500 images.",
    "Narrative review of 178 papers; keyword co-occurrence mapping.",
    "MobileNetV3 INT8 quantization; knowledge distillation from ResNet-50 teacher.",
    "Dual-arm robot + CNN regression for size estimation; 1,200 trials.",
    "Quantized MobileNetV3 on Raspberry Pi 4 and Jetson Nano; energy profiling.",
  ],
  "Sample / Dataset": [
    "3,200 tomato peduncle images, custom greenhouse dataset.",
    "1,800 ginger seedling RGB-D captures across growth stages.",
    "142 peer-reviewed studies from IEEE, Springer, Elsevier (2018–2025).",
    "4,500 lettuce leaf images; 6 deficiency classes.",
    "178 papers from Scopus and Web of Science.",
    "PlantVillage benchmark + custom edge hardware benchmarks.",
    "3 vegetable species; 1,200 transplanting trials in controlled greenhouse.",
    "PlantVillage + edge device thermal and energy logs.",
  ],
  "Key Findings": [
    "94.3% mAP; real-time inference at 47 FPS; robust under varying lighting.",
    "96.1% detection accuracy; shoot orientation error <3.2°.",
    "CNNs dominate (84% of studies); data scarcity is the primary bottleneck.",
    "91.8% overall accuracy; Fe deficiency achieves 97.4% recall.",
    "Vision Transformers now competitive with CNNs for disease segmentation.",
    "89.4% accuracy at 12 ms on Raspberry Pi 4; 2.1 MB model.",
    "94.7% transplanting success rate; 8.3 s cycle time.",
    "Inference at 12 ms; model size 2.1 MB; suitable for offline operation.",
  ],
  Limitations: [
    "Tested on tomato only; no outdoor occlusion testing.",
    "Single greenhouse environment; species generalization untested.",
    "Heterogeneous study designs limit meta-analytic synthesis.",
    "Limited to 6 nutrient types; controlled greenhouse conditions only.",
    "Does not include implementation-level evaluation of surveyed models.",
    "Accuracy drops ~5% under direct sunlight; fixed crop species.",
    "Single greenhouse setting; gripper not tested on fragile species.",
    "Accuracy drop under direct sunlight; species limited to PlantVillage classes.",
  ],
  Relevance: [
    "High — detection baseline directly applicable to lettuce systems.",
    "Moderate — transplanting mechanism transferable to leafy greens.",
    "High — foundational review for methodology selection in your RRL.",
    "Very High — direct lettuce focus with nutrient deficiency classification.",
    "High — state-of-the-art landscape for model architecture selection.",
    "High — edge deployment strategy applicable to field monitoring systems.",
    "High — dual-arm approach scalable to lettuce harvesting automation.",
    "High — energy and latency benchmarks inform hardware selection.",
  ],
};

const ACCENT = ["#c9a96e", "#7ab8a4", "#7e8fc7", "#b07ab8"];

export default function CompareModal({ papers, onClose }: CompareModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [openDims, setOpenDims] = useState<Set<string>>(
    new Set(DIMENSIONS.map((d) => d.key)),
  );

  // Simulate load delay
  useState(() => {
    const t = setTimeout(() => setIsLoading(false), 1600);
    return () => clearTimeout(t);
  });

  const toggle = (key: string) =>
    setOpenDims((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const paperIndices = papers.map((p) => {
    const idx = parseInt(p.id.split("-")[1] ?? "1") - 1;
    return Math.max(0, Math.min(idx, 7));
  });

  return (
    <div className={styles.modalOverlay}>
      <div
        className={styles.modal}
        style={{ width: "min(92vw, 960px)", height: "80vh" }}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <GitCompare size={15} style={{ color: "var(--primary)" }} />
            <span className={styles.modalTitle}>
              Comparing {papers.length} papers
            </span>
          </div>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={15} />
          </button>
        </div>

        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingIcon}>
              <div className={styles.loadingIconInner}>
                <Sparkles size={22} style={{ color: "var(--primary)" }} />
              </div>
              <Loader2
                size={44}
                className={styles.loadingSpinner}
                style={{ color: "rgba(201,169,110,0.15)" }}
              />
            </div>
            <p className={styles.loadingText}>
              Analyzing {papers.length} papers…
            </p>
          </div>
        ) : (
          <div className={styles.compareTable}>
            {/* Column headers */}
            <div className={styles.compareHeaderRow}>
              <div
                className={styles.dimLabelCol}
                style={{ borderRight: "1px solid var(--border)" }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.06em",
                  }}
                >
                  DIMENSION
                </span>
              </div>
              {papers.map((paper, i) => (
                <div
                  key={paper.id}
                  className={styles.dimColHeader}
                  style={{
                    borderRight:
                      i < papers.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    borderTop: `2px solid ${ACCENT[i % ACCENT.length]}`,
                  }}
                >
                  <div
                    className={styles.compareAccent}
                    style={{ color: ACCENT[i % ACCENT.length] }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                  <div className={styles.compareTitle}>
                    {paper.title.split(" ").slice(0, 7).join(" ")}…
                  </div>
                  <div className={styles.compareMeta}>
                    {paper.authors} · {paper.year}
                  </div>
                </div>
              ))}
            </div>

            {/* Dimension rows */}
            {DIMENSIONS.map(({ key, icon }) => {
              const isOpen = openDims.has(key);
              return (
                <div key={key} className={styles.dimRow}>
                  <button
                    className={styles.dimToggleBtn}
                    onClick={() => toggle(key)}
                  >
                    <span style={{ fontSize: 13 }}>{icon}</span>
                    <span style={{ flex: 1 }}>{key}</span>
                    {isOpen ? (
                      <ChevronDown
                        size={12}
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    ) : (
                      <ChevronRight
                        size={12}
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    )}
                  </button>
                  {isOpen && (
                    <div className={styles.dimContent}>
                      <div className={styles.dimSpacer} />
                      {papers.map((paper, i) => (
                        <div
                          key={paper.id}
                          className={styles.dimCell}
                          style={{
                            borderRight:
                              i < papers.length - 1
                                ? "1px solid var(--border)"
                                : "none",
                          }}
                        >
                          {MOCK_DATA[key]?.[paperIndices[i]] ?? "—"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
