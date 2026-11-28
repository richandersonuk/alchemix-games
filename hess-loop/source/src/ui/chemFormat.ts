const SUB_TO_ASCII: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
};

const ASCII_TO_SUB: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function transformOutsideTags(html: string, fn: (segment: string) => string): string {
  return html
    .split(/(<(?:sub|sup)>[\s\S]*?<\/(?:sub|sup)>|<[^>]+>)/g)
    .map((part) => (part.startsWith('<') ? part : fn(part)))
    .join('');
}

function normalizeSubDigits(text: string): string {
  return text
    .split('')
    .map((ch) => SUB_TO_ASCII[ch] ?? ch)
    .join('');
}

/**
 * Formats chemical formulas, equations, SI units, and official WJEC enthalpy notation
 * (e.g. Δ_f H^θ, Δ_latt form H^θ, Δ_hyd H^θ, E_a, kJ mol^-1) into safe HTML with <sub> and <sup>.
 */
export function formatChemHtml(input: string): string {
  let out = escapeHtml(input);

  // 1. Official WJEC enthalpy / thermodynamic symbols (accepting both θ and ° inputs)
  out = transformOutsideTags(out, (seg) =>
    seg
      .replace(
        /Δ(latt form|latt break|latt|ie\(1\+2\)|ie1|ea1|vap|hyd|sol|at|f|c|r)H([θ°])/g,
        'Δ<sub>$1</sub>H<sup>θ</sup>'
      )
      .replace(
        /Δ(latt form|latt break|latt|ie\(1\+2\)|ie1|ea1|vap|hyd|sol|at|f|c|r)H\b/g,
        'Δ<sub>$1</sub>H'
      )
      .replace(
        /ΔH([₁₂₃123])([θ°])/g,
        (_, idx: string) => `ΔH<sub>${normalizeSubDigits(idx)}</sub><sup>θ</sup>`
      )
      .replace(/ΔH([₁₂₃123])/g, (_, idx: string) => `ΔH<sub>${normalizeSubDigits(idx)}</sub>`)
      .replace(/Δ([HGS])([θ°])/g, 'Δ$1<sup>θ</sup>')
      .replace(/\bEa\b/g, 'E<sub>a</sub>')
  );

  // 2. SI unit exponents
  out = transformOutsideTags(out, (seg) =>
    seg
      .replace(/mol(?:⁻¹|-1)/g, 'mol<sup>−1</sup>')
      .replace(/dm(?:⁻³|-3)/g, 'dm<sup>−3</sup>')
      .replace(/K(?:⁻¹|-1)/g, 'K<sup>−1</sup>')
  );

  // 3. Stoichiometric half-coefficients & ionic charges
  out = transformOutsideTags(out, (seg) =>
    seg
      .replace(/(^|[\s(+×\[])0\.5/g, '$1½')
      .replace(/(^|[\s(+×\[])1\.5/g, '$11½')
      .replace(/(^|[\s(+×\[])3\.5/g, '$13½')
      .replace(/(²⁺|2\+)(?=\(|$|\s|\]|,|·)/g, '<sup>2+</sup>')
      .replace(/(³⁺|3\+)(?=\(|$|\s|\]|,|·)/g, '<sup>3+</sup>')
      .replace(/(²⁻|2-)(?=\(|$|\s|\]|,|·)/g, '<sup>2−</sup>')
      .replace(/([A-Za-z0-9])⁺/g, '$1<sup>+</sup>')
      .replace(/([A-Za-z0-9])⁻/g, '$1<sup>−</sup>')
      .replace(/([A-Za-z0-9])\+(?=\(|$|\s|\]|,)/g, '$1<sup>+</sup>')
      .replace(/([A-Za-z0-9])-(?=\(|$|\s|\]|,)/g, '$1<sup>−</sup>')
  );

  // 4. Chemical subscripts (Unicode ₀-₉ and ASCII formula digits, preserving U3 / Q10 / M1 / L01)
  out = transformOutsideTags(out, (seg) =>
    seg
      .replace(/[₀-₉]+/g, (digits) => `<sub>${normalizeSubDigits(digits)}</sub>`)
      .replace(/([A-Za-z)])(\d+)/g, (full, prefix: string, digits: string, offset: number) => {
        const beforeMatch = seg.slice(0, offset + prefix.length);
        const tokenMatch = beforeMatch.match(/[A-Za-z]+$/);
        const word = tokenMatch ? tokenMatch[0] : '';
        const nextChar = seg[offset + full.length] ?? '';
        if (
          (word === 'Q' || word === 'U' || word === 'M' || word === 'L' || word === 'p') &&
          !nextChar.match(/[A-Za-z]/)
        ) {
          return full;
        }
        return `${prefix}<sub>${digits}</sub>`;
      })
  );

  return out;
}

/**
 * Plain-text Unicode formatter for Canvas fallback, tooltips, and non-HTML attributes.
 */
export function prettifyChemText(input: string): string {
  return input
    .replace(/0\.5/g, '½')
    .replace(/1\.5/g, '1½')
    .replace(/3\.5/g, '3½')
    .replace(/2\+/g, '²⁺')
    .replace(/3\+/g, '³⁺')
    .replace(/2-/g, '²⁻')
    .replace(/([A-Za-z0-9])\+(?=\(|$|\s|])/g, '$1⁺')
    .replace(/([A-Za-z0-9])-(?=\(|$|\s|])/g, '$1⁻')
    .replace(/([A-Za-z)])(\d+)/g, (_, prefix: string, digits: string) => {
      const sub = digits
        .split('')
        .map((d) => ASCII_TO_SUB[d] ?? d)
        .join('');
      return `${prefix}${sub}`;
    });
}
