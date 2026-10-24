/* The complete directory is delivered as HTML. Search is an optional enhancement. */
(() => {
  "use strict";

  const search = document.getElementById("domain-search");
  const category = document.getElementById("category-filter");
  const toolbar = document.querySelector(".directory-toolbar");
  if (!search || !category || !toolbar) return;

  const sections = [...document.querySelectorAll(".directory-section")];
  const cards = sections.length
    ? sections.flatMap((section) => [...section.querySelectorAll(".domain-card")])
    : [...document.querySelectorAll("#directory .domain-card")];
  if (!cards.length) return;

  const resultCount = document.getElementById("result-count");
  const emptyState = document.getElementById("empty-results");
  const clearButton = document.getElementById("clear-filters");
  const normalize = (value) => String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const entries = cards.map((card) => ({
    card,
    text: normalize(`${card.dataset.name || ""} ${card.dataset.category || ""} ${card.dataset.search || card.textContent}`),
    category: normalize(card.dataset.category)
  }));

  const update = () => {
    const terms = normalize(search.value).split(/\s+/).filter(Boolean);
    const selected = normalize(category.value);
    const allCategories = !selected || selected === "all";
    let count = 0;

    for (const entry of entries) {
      const matches = (allCategories || selected === entry.category)
        && terms.every((term) => entry.text.includes(term));
      entry.card.hidden = !matches;
      if (matches) count += 1;
    }

    for (const section of sections) {
      section.hidden = ![...section.querySelectorAll(".domain-card")].some((card) => !card.hidden);
    }

    if (resultCount) {
      resultCount.textContent = count === cards.length
        ? `${count} domains to explore`
        : `${count} of ${cards.length} domains${count === 0 ? " match your filters" : " shown"}`;
    }
    if (emptyState) emptyState.hidden = count !== 0;
  };

  search.addEventListener("input", update);
  category.addEventListener("change", update);
  if (toolbar.tagName === "FORM") toolbar.addEventListener("submit", (event) => event.preventDefault());
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      search.value = "";
      category.value = [...category.options].find((option) => !option.value || normalize(option.value) === "all")?.value || "";
      update();
      search.focus();
    });
  }

  toolbar.hidden = false;
  update();
})();
