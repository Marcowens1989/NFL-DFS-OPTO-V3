# Project Chimera: Master Directives

This document is the single source of truth for the core principles and architectural mandates of the NFL Showdown Optimizer. All directives are permanent, self-reinforcing, and are to be applied universally.

---

### Pillar I: The Unbreakable Data Fortress

*   **Core Principle:** The system will never be reliant on a single point of failure. It prioritizes free, fast, and redundant data sources. The AI is the master synthesizer, not the fragile foundation.

1.  **The Data Waterfall:** For every critical piece of data (injuries, odds, projections), the app must try a sequence of sources. It will start with fast, free, dedicated APIs and scrapers. Only if those fail does it fall back to the next source, with the powerful (but costly) Gemini analysis as the final, intelligent safety net.
2.  **The Static Data Vault:** A pre-processed, static library of historical game data must be embedded directly into the application. This ensures a baseline of high-performance, AI-proof backtesting capability, reduces reliance on external services for known data, and improves the overall efficiency and resilience of the system.
3.  **Manual Data Ingestion:** The Projections Lab must provide a user-friendly interface for manually uploading raw game book text. The system will use AI to parse this data, calculate contest-true FDPs, and add the result to the permanent Data Fortress, allowing the user to expand the engine's knowledge base on demand.

---

### Pillar II: The Self-Learning Intelligence Core

*   **Core Principle:** The engine must get smarter every single day, even overnight. It uses a rigorous, scientific methodology to prove its models are improving.

4.  **Infinite Self-Improvement Protocol**: The system must implement a self-reinforcing continual learning framework. It will auto-initiate retraining cycles across all modules using historical data and new insights to relentlessly improve its predictive accuracy.
5.  **Permanent Troubleshooting Memory**: The system will retain *all* troubleshooting insights indefinitely in a structured, persistent knowledge base. It will log every error, fix, and optimization with granular detail. It must auto-reference this knowledge base before generating any script or prediction to prevent recurrence.
6.  **Anti-Stagnation Enforcement**: The system must detect performance plateaus (e.g., ROI gain <1% over 3 cycles) and trigger a forced evolution by exploring alternative models or techniques.
7.  **The "Live Pipeline" Mandate:** The prediction engine for a live slate will have **ZERO access to outcome data**. Its entire process for live slates must be identical to its process for the "final exam" on the blind validation set, guaranteeing true predictive power without data leakage.
8.  **The "No-Peeking" Protocol:** The model discovery engine is constitutionally forbidden from using any post-lock information (e.g., in-game events) to inform the creation of its hindsight-tuned models. Its sole purpose is to find the best possible *pre-game* predictive model that would have most accurately forecasted the final, known stats, using only the context that was available before kickoff. This ensures zero data leakage and true predictive integrity.
9.  **The Chimera Overnight Training Engine:** The system must be able to run a continuous, 24/7 simulation loop in the background without freezing the UI. This engine will relentlessly discover, validate, and save new, improved models.
10. **The Oracle's Heartbeat:** The overnight training engine must provide a fully interactive, real-time training dashboard. It must provide a live log, a real-time performance graph, and an interactive history chart to give transparent, undeniable proof of the model's continuous improvement.


---

### Pillar III: The Quantitative & Game Theory Engine

*   **Core Principle:** We don't just build good lineups; we engineer GPP-winning portfolios by understanding the numbers *and* the psychology of the field.

11. **The Psychographic & Game Theory Overlay:** The system must go beyond raw stats to model the behavior of the entire DFS field. It will analyze slate narratives, model common opponent behaviors, and optimize for lineup uniqueness to achieve a dominant, game-theory-based edge.
12. **Contest-Dynamic ROI Modeling:** The system must analyze and exploit contest structures, including payout ladders and duplication probability (via ownership product), to optimize for maximum, real-world Return on Investment, not just raw fantasy points.
13. **The Opportunity Doctrine:** The system must model and differentiate between **Opportunity Metrics** (e.g., Target Share, Air Yards, Red Zone Touches) and **Production Metrics** (e.g., Receptions, Receiving Yards). True predictive power lies in opportunity, not just outcome.
14. **High-Value Touch Supremacy:** The engine must explicitly identify and weight high-value opportunities, such as red zone touches and deep targets, as they are the primary drivers of GPP-winning upside.
15. **Multi-Philosophy Model Competition:** The system is mandated to generate and validate models from multiple distinct analytical philosophies—statistical regression (Quant), AI-driven hindsight (Hindsight), and expert-driven heuristics (Opportunity)—and allow them to compete in a blind validation gauntlet. The most predictively accurate philosophy shall prevail.

---

### Pillar IV: The Professional-Grade Feedback Loop

*   **Core Principle:** A true professional system doesn't stop when the games lock. It must provide tools for post-contest analysis to make the model *and* the user smarter.

16. **Post-Slate Diagnostic & Leakfinder Engine**: The system will provide tools to ingest a user's actual contest results. It will grade their lineups, compare them to the model's recommendations, and run an AI-powered analysis to find personal biases or "leaks" in the user's strategy.

---

### Pillar V: Ruthless Efficiency & Unbreakable Resilience

*   **Core Principle:** The app must NEVER break. Performance is a feature, not a bonus.

17. **The Pledge of Truth**: The system will never lie, fabricate, or make up stats or results. All system capabilities will be represented with 100% transparency. It will always own the results, good or bad.
18. **The Efficiency Mandate:** All architecture and algorithms will be designed for maximum efficiency, with the goal of creating a system that is resilient, scalable, and feels instantaneous to the user. This includes using memoization for core algorithms and other advanced performance techniques.
19. **The Oracle Protocol**: Full authority is granted to the AI to automate all decisions—model selection, feature engineering, and strategic adjustments—in the relentless pursuit of creating the world's most accurate and profitable NFL Showdown prediction model. Human oversight is for validation and strategic alignment, not manual intervention.
20. **Non-Redundancy Mandate**: Never introduce a redundant feature. Every new component must be a distinct evolution that makes the system smarter, faster, more resilient, or provides a new, quantifiable edge.