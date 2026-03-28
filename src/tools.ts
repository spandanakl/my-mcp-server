import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerTools(server: McpServer) {

  // ─── Tool 1 — Calculate Drug Dosage ───────────────────────────────────────
  server.tool(
    "calculate_drug_dosage",
    "Calculate a safe starting dose for a new drug compound based on body weight, potency, route of administration and safety factor. Useful in early Phase I clinical trial planning.",
    {
      body_weight_kg: z
        .number()
        .positive()
        .describe("Patient body weight in kilograms"),
      dose_per_kg: z
        .number()
        .positive()
        .describe("Intended dose in mg per kg of body weight (from preclinical data)"),
      route: z
        .enum(["oral", "intravenous", "intramuscular", "subcutaneous", "topical"])
        .describe("Route of administration"),
      safety_factor: z
        .number()
        .min(1)
        .max(20)
        .default(10)
        .describe("Safety factor divisor applied to preclinical dose (default 10 for Phase I first-in-human)"),
    },
    async ({ body_weight_kg, dose_per_kg, route, safety_factor }) => {
      // Bioavailability adjustment by route
      const bioavailability: Record<string, number> = {
        intravenous: 1.0,
        intramuscular: 0.9,
        subcutaneous: 0.85,
        oral: 0.6,
        topical: 0.1,
      };

      const ba = bioavailability[route];
      const preclinical_dose_mg = body_weight_kg * dose_per_kg;
      const adjusted_dose_mg = (preclinical_dose_mg * ba) / safety_factor;
      const rounded = Math.round(adjusted_dose_mg * 100) / 100;

      return {
        content: [{
          type: "text",
          text: `Drug Dosage Calculation — Phase I Starting Dose Estimate

Input Parameters:
• Body Weight: ${body_weight_kg} kg
• Preclinical Dose: ${dose_per_kg} mg/kg
• Route of Administration: ${route}
• Bioavailability Factor: ${(ba * 100).toFixed(0)}%
• Safety Factor: ${safety_factor}x

Results:
• Unadjusted Preclinical Dose: ${preclinical_dose_mg.toFixed(2)} mg
• Bioavailability-Adjusted Dose: ${(preclinical_dose_mg * ba).toFixed(2)} mg
• Recommended Starting Dose (after safety factor): ${rounded} mg

Formula Used:
  Starting Dose = (Body Weight × Dose/kg × Bioavailability) ÷ Safety Factor

⚠️ This is an estimate for early planning purposes only. Final first-in-human doses must be determined by a clinical pharmacologist and reviewed by the ethics committee and regulatory authority.`,
        }],
      };
    }
  );

  // ─── Tool 2 — Check Excipient Compatibility ───────────────────────────────
  server.tool(
    "check_excipient_compatibility",
    "Check whether two common pharmaceutical excipients are compatible with each other in a drug formulation. Useful during formulation development.",
    {
      excipient_1: z
        .string()
        .min(1)
        .describe("First excipient name (e.g. Lactose, Magnesium stearate, HPMC)"),
      excipient_2: z
        .string()
        .min(1)
        .describe("Second excipient name"),
      dosage_form: z
        .enum(["tablet", "capsule", "injection", "suspension", "cream", "powder"])
        .describe("The intended dosage form"),
    },
    async ({ excipient_1, excipient_2, dosage_form }) => {

      // Compatibility knowledge base
      const incompatibilities: Record<string, {
        severity: "mild" | "moderate" | "severe";
        reason: string;
        recommendation: string;
      }> = {
        "magnesium stearate_lactose": {
          severity: "mild",
          reason: "Magnesium stearate can form a hydrophobic film around lactose particles, slightly reducing dissolution rate.",
          recommendation: "Limit magnesium stearate to ≤1% w/w. Mix for minimum time necessary (3–5 minutes).",
        },
        "sodium bicarbonate_citric acid": {
          severity: "moderate",
          reason: "Effervescent reaction occurs when combined in the presence of moisture, producing CO₂ and potentially destabilising the formulation.",
          recommendation: "Keep dry during manufacturing. Only combine in effervescent formulations where this reaction is intentional.",
        },
        "microcrystalline cellulose_magnesium stearate": {
          severity: "mild",
          reason: "Overlubrication possible with extended blending, leading to reduced hardness and slower dissolution.",
          recommendation: "Add magnesium stearate last in blending. Blend for no more than 3–5 minutes.",
        },
        "calcium carbonate_tetracycline": {
          severity: "severe",
          reason: "Calcium ions form insoluble chelates with tetracycline, significantly reducing bioavailability.",
          recommendation: "Avoid combining. Use alternative filler if tetracycline-class API is present.",
        },
        "starch_water": {
          severity: "mild",
          reason: "Excess moisture causes starch gelatinisation, affecting tablet hardness and disintegration.",
          recommendation: "Control moisture levels during wet granulation. Dry to target moisture content.",
        },
        "povidone_sodium lauryl sulfate": {
          severity: "mild",
          reason: "Interaction may form a complex reducing the effectiveness of both excipients.",
          recommendation: "Evaluate in small-scale formulation study before scale-up.",
        },
        "hpmc_carbomer": {
          severity: "mild",
          reason: "Both are viscosity-increasing agents. Combined use may over-thicken the formulation unpredictably.",
          recommendation: "Optimise concentrations carefully. Run viscosity studies at intended ratios.",
        },
      };

      const normalize = (s: string) => s.toLowerCase().trim();
      const e1 = normalize(excipient_1);
      const e2 = normalize(excipient_2);

      const key1 = `${e1}_${e2}`;
      const key2 = `${e2}_${e1}`;
      const issue = incompatibilities[key1] || incompatibilities[key2];

      const severityEmoji = { mild: "🟡", moderate: "🟠", severe: "🔴" };

      if (!issue) {
        return {
          content: [{
            type: "text",
            text: `Excipient Compatibility Check

• Excipient 1: ${excipient_1}
• Excipient 2: ${excipient_2}
• Dosage Form: ${dosage_form}

✅ No known incompatibility found in the database for this combination.

Note: Absence of a recorded incompatibility does not guarantee compatibility. Always perform physical and chemical compatibility studies (DSC, FTIR, stress testing) during formal formulation development.`,
          }],
        };
      }

      return {
        content: [{
          type: "text",
          text: `Excipient Compatibility Check

• Excipient 1: ${excipient_1}
• Excipient 2: ${excipient_2}
• Dosage Form: ${dosage_form}

${severityEmoji[issue.severity]} Compatibility Issue — ${issue.severity.toUpperCase()}
• Reason: ${issue.reason}
• Recommendation: ${issue.recommendation}

⚠️ Confirm with formal compatibility studies (DSC, FTIR, accelerated stability testing) before proceeding to formulation scale-up.`,
        }],
      };
    }
  );

  // ─── Tool 3 — Estimate Shelf Life ─────────────────────────────────────────
  server.tool(
    "estimate_shelf_life",
    "Estimate the shelf life of a drug product based on storage conditions and degradation rate using the Arrhenius equation. Useful in stability study planning.",
    {
      degradation_rate_25c: z
        .number()
        .positive()
        .describe("Degradation rate constant at 25°C (% potency loss per month)"),
      activation_energy_kj: z
        .number()
        .positive()
        .describe("Activation energy of the degradation reaction in kJ/mol (typical range: 50–100 kJ/mol)"),
      storage_temperature_c: z
        .number()
        .describe("Intended storage temperature in °C (e.g. 25 for room temp, 5 for refrigerated, 40 for accelerated)"),
      minimum_potency_percent: z
        .number()
        .min(50)
        .max(99)
        .default(90)
        .describe("Minimum acceptable potency % for the product to remain in specification (default 90%)"),
    },
    async ({ degradation_rate_25c, activation_energy_kj, storage_temperature_c, minimum_potency_percent }) => {
      // Arrhenius equation: k(T) = k(25) × exp[(Ea/R) × (1/298 - 1/T)]
      const R = 0.008314; // kJ/mol/K
      const T_ref = 298;  // 25°C in Kelvin
      const T_storage = storage_temperature_c + 273.15;

      const rate_at_storage =
        degradation_rate_25c *
        Math.exp((activation_energy_kj / R) * (1 / T_ref - 1 / T_storage));

      // Time to degrade from 100% to minimum potency
      const months_to_limit = (100 - minimum_potency_percent) / rate_at_storage;
      const shelf_life_months = Math.floor(months_to_limit * 0.9); // 10% safety margin
      const shelf_life_years = (shelf_life_months / 12).toFixed(1);

      const storageLabel =
        storage_temperature_c <= 8
          ? "Refrigerated (2–8°C)"
          : storage_temperature_c <= 25
          ? "Room Temperature (15–25°C)"
          : storage_temperature_c <= 30
          ? "Controlled Room Temperature (up to 30°C)"
          : "Accelerated Conditions (40°C)";

      return {
        content: [{
          type: "text",
          text: `Shelf Life Estimate — Arrhenius Model

Input Parameters:
• Degradation Rate at 25°C: ${degradation_rate_25c}% potency loss/month
• Activation Energy: ${activation_energy_kj} kJ/mol
• Storage Condition: ${storageLabel}
• Minimum Acceptable Potency: ${minimum_potency_percent}%

Results:
• Degradation Rate at ${storage_temperature_c}°C: ${rate_at_storage.toFixed(4)}% per month
• Estimated Time to Reach Limit: ${months_to_limit.toFixed(1)} months
• Recommended Shelf Life (with 10% safety margin): ${shelf_life_months} months (${shelf_life_years} years)

ICH Stability Guidelines Reference:
• Zone I/II (Temperate/Subtropical): 25°C / 60% RH — 12 months real-time
• Zone III/IV (Hot/Hot-Humid): 30°C / 65–75% RH — 12 months real-time
• Accelerated: 40°C / 75% RH — 6 months

⚠️ This is a mathematical estimate. Shelf life must be confirmed by ICH-compliant real-time and accelerated stability studies before regulatory submission.`,
        }],
      };
    }
  );

  // ─── Tool 4 — Classify Adverse Event ──────────────────────────────────────
  server.tool(
    "classify_adverse_event",
    "Classify an adverse event (AE) by severity grade using the CTCAE (Common Terminology Criteria for Adverse Events) framework. Used in clinical trial safety reporting.",
    {
      event_type: z
        .enum([
          "nausea",
          "vomiting",
          "fatigue",
          "headache",
          "rash",
          "liver_enzyme_elevation",
          "neutropenia",
          "hypertension",
          "peripheral_neuropathy",
          "diarrhoea",
        ])
        .describe("Type of adverse event observed"),
      severity_description: z
        .enum([
          "mild_no_intervention",
          "moderate_minimal_intervention",
          "severe_hospitalization",
          "life_threatening",
          "death",
        ])
        .describe("Clinical severity of the event as observed"),
      is_serious: z
        .boolean()
        .describe("Whether the event meets serious adverse event (SAE) criteria — e.g. hospitalization, disability, life-threatening"),
      is_related_to_drug: z
        .enum(["definite", "probable", "possible", "unlikely", "unrelated"])
        .describe("Investigator's causality assessment — relationship to study drug"),
    },
    async ({ event_type, severity_description, is_serious, is_related_to_drug }) => {

      const gradeMap: Record<string, number> = {
        mild_no_intervention: 1,
        moderate_minimal_intervention: 2,
        severe_hospitalization: 3,
        life_threatening: 4,
        death: 5,
      };

      const grade = gradeMap[severity_description];

      const gradeDescriptions: Record<number, string> = {
        1: "Grade 1 — Mild. Asymptomatic or mild symptoms. Clinical or diagnostic observations only. No intervention indicated.",
        2: "Grade 2 — Moderate. Minimal, local or non-invasive intervention indicated. Limiting age-appropriate instrumental activities of daily life.",
        3: "Grade 3 — Severe. Severe or medically significant but not immediately life-threatening. Hospitalization or prolongation of hospitalization indicated.",
        4: "Grade 4 — Life-threatening. Life-threatening consequences. Urgent intervention indicated.",
        5: "Grade 5 — Death. Death related to AE.",
      };

      const regulatoryActions: Record<number, string> = {
        1: "Monitor and document. No dose modification typically required.",
        2: "Document and monitor closely. Consider dose modification per protocol guidelines.",
        3: "Dose interruption or reduction likely required. Report as per protocol. If meets SAE criteria, report within 24 hours.",
        4: "Immediate dose discontinuation. Urgent medical management. Report as SAE within 24 hours to sponsor and IRB/Ethics Committee.",
        5: "Immediate reporting to regulatory authority (7-day expedited report). Full investigation required.",
      };

      const causality = {
        definite: "Definitively related — strong temporal relationship and no alternative explanation.",
        probable: "Probably related — temporal relationship and unlikely due to other causes.",
        possible: "Possibly related — temporal relationship but other causes cannot be ruled out.",
        unlikely: "Unlikely related — another cause more plausible but temporal relationship exists.",
        unrelated: "Unrelated — clearly due to another cause.",
      }[is_related_to_drug];

      const gradeEmoji = ["", "🟢", "🟡", "🟠", "🔴", "⚫"];

      return {
        content: [{
          type: "text",
          text: `Adverse Event Classification — CTCAE v5.0

Event Details:
• Adverse Event Type: ${event_type.replace(/_/g, " ")}
• Causality Assessment: ${causality}
• Serious Adverse Event (SAE): ${is_serious ? "YES — SAE criteria met" : "No"}

${gradeEmoji[grade]} CTCAE Grade: ${grade}
${gradeDescriptions[grade]}

Regulatory Action Required:
${regulatoryActions[grade]}

${is_serious ? `🚨 SAE Reporting:
• This event meets SAE criteria.
• Sponsor must be notified immediately (within 24 hours of awareness).
• If unexpected and related: submit expedited IND Safety Report (15-day for non-fatal, 7-day for fatal/life-threatening).
• Document in Case Report Form (CRF) and safety database.` : ""}

Causality: ${is_related_to_drug.charAt(0).toUpperCase() + is_related_to_drug.slice(1)} relationship to study drug.

⚠️ All AE classifications must be reviewed and confirmed by the Principal Investigator and Medical Monitor before regulatory submission.`,
        }],
      };
    }
  );
}