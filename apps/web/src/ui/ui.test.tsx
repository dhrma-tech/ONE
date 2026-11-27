import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Checklist, ContributionGrid, StatCard, PillButton, Pager } from "./index";
import { addDays, today } from "@/lib/dates";

describe("ContributionGrid", () => {
  it("renders 53x7 cells with accessible labels and counts active days", () => {
    const days = [
      { date: today(), level: 4 as const, note: "4 sections done" },
      { date: addDays(today(), -1), level: 2 as const },
    ];
    render(<ContributionGrid days={days} label="Master" />);
    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("aria-label", "Master: 2 active days");
    expect(screen.getAllByRole("gridcell")).toHaveLength(53 * 7);
    expect(screen.getByLabelText(/4 sections done/)).toHaveClass("l4", "today");
  });
});

describe("StatCard", () => {
  it("exposes the real value to assistive tech and shows a dash when empty", () => {
    render(
      <>
        <StatCard label="Weight" value={51.2} unit="kg" decimals={1} />
        <StatCard label="Rapid" value={null} />
      </>,
    );
    expect(screen.getByLabelText("Weight: 51.2 kg")).toBeInTheDocument();
    expect(screen.getByLabelText("Rapid: no data")).toHaveTextContent("—");
  });
});

describe("Checklist", () => {
  it("toggles items", () => {
    const onToggle = vi.fn();
    render(<Checklist items={[{ id: "a", label: "Block 1", done: false }]} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Block 1" }));
    expect(onToggle).toHaveBeenCalledWith("a", true);
  });
});

describe("PillButton and Pager", () => {
  it("renders a link pill and a finite pager", () => {
    const onPage = vi.fn();
    render(
      <MemoryRouter>
        <PillButton to="/career">Show all</PillButton>
        <Pager page={0} pages={3} onPage={onPage} total={50} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /show all/i })).toHaveAttribute("href", "/career");
    expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPage).toHaveBeenCalledWith(1);
  });
});
