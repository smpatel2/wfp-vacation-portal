# Unified Visual Plan: Glassmorphism & Floating Cards

This specification unifies the visual direction for the Wheaton Family Practice Vacation Portal to achieve a truly sleek, modern, and premium web application feel.

## 1. The Foundation: Mesh Gradient & Typography
For glassmorphism to look good, it needs a dynamic background to refract. A solid white or gray background makes glassmorphism invisible.

*   **Global Background:** A subtle, clinical, and calming CSS mesh gradient using Duly Health's lighter color spectrum.
    *   *Colors:* Pale Mint, Soft Sky Blue, and Clean White.
    *   *Animation:* A very slow, imperceptible CSS rotation animation for the gradient background adds a premium "alive" feel.
*   **Typography:** Switch to **Outfit** (or Inter) via Google Fonts. Headings will use heavy weights (600/700) with tight tracking, while body text will have generous line height for readability.

## 2. Floating Card Architecture
Instead of standard block layout elements, the primary sections of the app will act as suspended glass panels above the mesh background.

*   **The Glass Recipe (Applied to UI Cards):**
    ```css
    .glass-panel {
        background: rgba(255, 255, 255, 0.7); /* Translucent white */
        backdrop-filter: blur(16px);          /* The frosted glass effect */
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.6); /* Highlights edges */
        box-shadow: 0 12px 40px rgba(0, 59, 74, 0.05); /* Very soft navy shadow */
        border-radius: 20px;
    }
    ```
*   **Application Blocks:**
    *   **Login Modal:** Centered glass card.
    *   **Main Header:** Floating pill-shaped header bridging the top of the interface, detached from the viewport edges.
    *   **Sidebar:** Detached floating glass card on the right.
    *   **Calendar Panel:** The main interaction stage.

## 3. The Calendar (The Content Stage)
The calendar grid itself should dissolve into the glass panel. We build on the borderless updates you started:

*   **Interactive Cells:** Day cells stay invisible until hovered. On hover, a softly rounded background fades in (`border-radius: 12px`).
*   **Navigation:** Your new `.calendar-nav` will be styled inside a suspended capsule element with smooth, border-less icon buttons.
*   **Event Pills:** Selected dates (pending/submitted) inside the grid will be rounded pills with a vibrant Duly Teal (`#008298`) gradient for "Pending" and Rich Green (`#2E8540`) for "Submitted".

## 4. Sidebar Transformation
The sidebar will be a compact, highly efficient command center.

*   **Horizontal Chips:** Selected dates become flex-wrapping pill chips. This saves massive amounts of vertical space.
*   **Pinned Action Footer:** The "Submit" container sits at the very bottom of the sidebar glass card, ensuring it is never lost beneath a scroll limit.
*   **Empty State Delight:** Add a minimal SVG vector to make the "Click or drag to select" state visually pleasing.

## 5. Next-Level Micro-Interactions
*   **Button Hovers:** Buttons will slightly elevate (translate Y) and increase shadow depth on hover.
*   **Input Fields:** Inputs will have a soft inset shadow and a translucent background un-focus, switching to a solid white background with a teal glow on focus.
*   **Transition Magic:** All hover states will use a standard `transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);` for that highly polished, Apple-like smoothness.
