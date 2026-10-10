"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";


import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;``

const GITHUB_URL = "https://github.com/abhinavkale-dev/fynt";
const X_URL = "https://x.com/Abhinavstwt";
const PIKOREELS_URL = "https://pikoreels.com";
const VERCEL_OSS_URL = "https://vercel.com/open-source-program";
const PRIVACY_URL = "/privacy";
const TERMS_URL = "/terms";

const normalizeFooterLink = (href: string) => href.replace(/\/+$/, "");
const allowedFooterLinks = new Set([
  normalizeFooterLink(GITHUB_URL),
  normalizeFooterLink(X_URL),
  normalizeFooterLink(PIKOREELS_URL),
  normalizeFooterLink(VERCEL_OSS_URL),
  normalizeFooterLink(PRIVACY_URL),
  normalizeFooterLink(TERMS_URL),
]);
const LogoSvg = () => (
  <svg
    width="34"
    height="34"
    viewBox="-1 -1 33 33"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="block overflow-visible"
  >
    <g filter="url(#a)">
      <g filter="url(#b)">
        <rect
          x=".5"
          y=".5"
          width="29.998"
          height="30.003"
          rx="4.5"
          stroke="#ff6e00"
        />
      </g>
      <g filter="url(#c)" fill="#ff6e00">
        <path d="m6.86 25.366 1.004-5.462h5.684l-1.115 5.462zm6.91-5.462 1.226-5.796h5.573l-1.338 5.796z" />
        <path d="m11.541 17.006 1.226-5.685h11.48l1.114-5.684H7.864l-2.23 11.37z" />
      </g>
    </g>
    <defs>
      <filter
        id="a"
        x="0"
        y="0"
        width="31.198"
        height="31.203"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feColorMatrix
          in="SourceAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dx=".2" dy=".2" />
        <feGaussianBlur stdDeviation=".25" />
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
        <feBlend in2="shape" result="effect1_innerShadow_642_873" />
      </filter>
      <filter
        id="b"
        x="0"
        y="0"
        width="31.198"
        height="31.203"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feColorMatrix
          in="SourceAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dx=".2" dy=".2" />
        <feGaussianBlur stdDeviation=".4" />
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
        <feBlend in2="shape" result="effect1_innerShadow_642_873" />
      </filter>
      <filter
        id="c"
        x="5.635"
        y="5.637"
        width="20.827"
        height="20.829"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feColorMatrix
          in="SourceAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dx="1.1" dy="1.1" />
        <feGaussianBlur stdDeviation="1.05" />
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.62 0" />
        <feBlend in2="shape" result="effect1_innerShadow_642_873" />
      </filter>
    </defs>
  </svg>
);
const FooterSectionSeparator = () => (
  <>
    <div className="hidden">
      <div className="flex-shrink-0">
        <svg
          width="9"
          height="9"
          viewBox="0 0 9 9"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0.5" y="0.5" width="8" height="8" rx="2" fill="#F04D26" />
        </svg>
      </div>
      <div className="relative w-full max-w-2xl h-px bg-white/30" />
      <div className="flex-shrink-0">
        <svg
          width="9"
          height="9"
          viewBox="0 0 9 9"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0.5" y="0.5" width="8" height="8" rx="2" fill="#F04D26" />
        </svg>
      </div>
    </div>

    <div className="hidden xl:flex items-center w-full mx-auto pointer-events-none z-20 py-12 justify-center">
      <div className="flex-shrink-0">
        <svg
          width="9"
          height="9"
          viewBox="0 0 9 9"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0.5" y="0.5" width="8" height="8" rx="2" fill="#F04D26" />
        </svg>
      </div>
      <div className="relative w-full max-w-6xl h-px bg-white/30" />
      <div className="flex-shrink-0">
        <svg
          width="9"
          height="9"
          viewBox="0 0 9 9"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0.5" y="0.5" width="8" height="8" rx="2" fill="#F04D26" />
        </svg>
      </div>
    </div>
  </>
);
const ColumnSeparator = () => (
  <div className="hidden xl:flex flex-col items-center justify-start pointer-events-none">
    <div className="flex-shrink-0">
      <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="0.5" y="0.5" width="8" height="8" rx="2" fill="#F04D26" />
      </svg>
    </div>

    <div className="relative w-px h-78 bg-white/30" />

    <div className="flex-shrink-0">
      <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="0.5" y="0.5" width="8" height="8" rx="2" fill="#F04D26" />
      </svg>
    </div>
  </div>
);
export function Footer() {
  const currentYear = new Date().getFullYear();
  const blockDisallowedFooterNavigation = (
    event: ReactMouseEvent<HTMLElement>,
  ) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const anchor = target.closest("a");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    if (allowedFooterLinks.has(normalizeFooterLink(href))) return;
    event.preventDefault();
    event.stopPropagation();
  };
  return (
    <footer
      className="relative pt-8 pb-0 overflow-hidden"
      onClickCapture={blockDisallowedFooterNavigation}
      onAuxClickCapture={blockDisallowedFooterNavigation}
    >
      <div className="mx-auto max-w-7xl px-6">
        

        <FooterSectionSeparator />

        <div className="relative z-10 max-w-6xl mx-auto -mb-3">
          <div className="xl:hidden divide-y divide-white/10 border-y border-white/10 mb-8">
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center justify-between py-5 text-left">
                <h3 className="text-white font-semibold text-sm">Product</h3>
                <div className="flex size-5 items-center justify-center rounded-full bg-white/10">
                  <ChevronDown className="h-3 w-3 text-white/70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-5">
                <ul className="space-y-3">
                  <li>
                    <a
                      href="#workflows"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Workflows
                    </a>
                  </li>
                  <li>
                    <a
                      href="#integrations"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Integrations
                    </a>
                  </li>
                  <li>
                    <a
                      href="#templates"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Templates
                    </a>
                  </li>
                  <li>
                    <a
                      href="#pricing"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Pricing
                    </a>
                  </li>
                </ul>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center justify-between py-5 text-left">
                <h3 className="text-white font-semibold text-sm">Resources</h3>
                <div className="flex size-5 items-center justify-center rounded-full bg-white/10">
                  <ChevronDown className="h-3 w-3 text-white/70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-5">
                <ul className="space-y-3">
                  <li>
                    <a
                      href="#documentation"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Documentation
                    </a>
                  </li>
                  <li>
                    <a
                      href="#guides"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Guides
                    </a>
                  </li>
                  <li>
                    <a
                      href="#blog"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Blog
                    </a>
                  </li>
                  <li>
                    <a
                      href="#tutorials"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Tutorials
                    </a>
                  </li>
                </ul>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center justify-between py-5 text-left">
                <h3 className="text-white font-semibold text-sm">Developers</h3>
                <div className="flex size-5 items-center justify-center rounded-full bg-white/10">
                  <ChevronDown className="h-3 w-3 text-white/70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-5">
                <ul className="space-y-3">
                  <li>
                    <a
                      href="#api"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      API Reference
                    </a>
                  </li>
                  <li>
                    <a
                      href="#sdks"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      SDKs
                    </a>
                  </li>
                  <li>
                    <a
                      href="#webhooks"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Webhooks
                    </a>
                  </li>
                  <li>
                    <a
                      href="#examples"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Examples
                    </a>
                  </li>
                </ul>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center justify-between py-5 text-left">
                <h3 className="text-white font-semibold text-sm">Community</h3>
                <div className="flex size-5 items-center justify-center rounded-full bg-white/10">
                  <ChevronDown className="h-3 w-3 text-white/70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-5">
                <ul className="space-y-3">
                  <li>
                    <a
                      href="https://discord.gg/fynt"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Discord
                    </a>
                  </li>
                  <li>
                    <a
                      href={GITHUB_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      GitHub
                    </a>
                  </li>
                  <li>
                    <a
                      href="#support"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Support
                    </a>
                  </li>
                  <li>
                    <a
                      href="#status"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Status
                    </a>
                  </li>
                </ul>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center justify-between py-5 text-left">
                <h3 className="text-white font-semibold text-sm">Company</h3>
                <div className="flex size-5 items-center justify-center rounded-full bg-white/10">
                  <ChevronDown className="h-3 w-3 text-white/70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-5">
                <ul className="space-y-3">
                  <li>
                    <a
                      href="#about"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      About
                    </a>
                  </li>
                  <li>
                    <a
                      href="#contact"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Contact
                    </a>
                  </li>
                  <li>
                    <a
                      href="#careers"
                      className="text-white/60 hover:text-white text-sm transition-colors block"
                    >
                      Careers
                    </a>
                  </li>
                  <li>
                    <a
                      href={PIKOREELS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#F04D26] hover:text-[#ff6e00] text-sm transition-colors"
                    >
                      Pikoreels
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </li>
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="xl:hidden py-5 text-center">
            <p className="text-white/60 text-sm">
              © {currentYear} Fynt. All rights reserved.
            </p>
          </div>

          <div className="hidden xl:flex justify-center items-start gap-12 mb-1">
            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm mb-4">Product</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#workflows"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Workflows
                  </a>
                </li>
                <li>
                  <a
                    href="#integrations"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Integrations
                  </a>
                </li>
                <li>
                  <a
                    href="#templates"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Templates
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Pricing
                  </a>
                </li>
              </ul>
            </div>

            <ColumnSeparator />

            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm mb-4">
                Resources
              </h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#documentation"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="#guides"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Guides
                  </a>
                </li>
                <li>
                  <a
                    href="#blog"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href="#tutorials"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Tutorials
                  </a>
                </li>
              </ul>
            </div>

            <ColumnSeparator />

            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm mb-4">
                Developers
              </h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#api"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    API Reference
                  </a>
                </li>
                <li>
                  <a
                    href="#sdks"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    SDKs
                  </a>
                </li>
                <li>
                  <a
                    href="#webhooks"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Webhooks
                  </a>
                </li>
                <li>
                  <a
                    href="#examples"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Examples
                  </a>
                </li>
              </ul>
            </div>

            <ColumnSeparator />

            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm mb-4">
                Community
              </h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://discord.gg/fynt"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Discord
                  </a>
                </li>
                <li>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="#support"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Support
                  </a>
                </li>
                <li>
                  <a
                    href="#status"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Status
                  </a>
                </li>
              </ul>
            </div>

            <ColumnSeparator />

            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm mb-4">Company</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#about"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#contact"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <a
                    href="#careers"
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Careers
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <FooterSectionSeparator />

          <div className="hidden xl:flex flex-col md:flex-row items-center justify-between pt-1 pb-6">
            <p className="text-white/60 text-sm mb-2 md:mb-0">
              © {currentYear} WorkOrch. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a
                href="/privacy"
                className="text-white/60 hover:text-white text-sm transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="text-white/60 hover:text-white text-sm transition-colors"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}