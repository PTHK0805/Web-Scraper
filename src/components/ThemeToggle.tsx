// src/components/ThemeToggle.tsx
'use client'

import * as React from "react"
import { Moon, Sun } from "lucide-react" // Import icons
import { useTheme } from "next-themes" // Import the hook from next-themes

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu" // Import DropdownMenu components

export function ThemeToggle() {
  // Get the setTheme function and the current theme state from next-themes
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      {/* The trigger is a button with icons indicating the current mode */}
      <DropdownMenuTrigger asChild>
        <Button
            variant="outline"
            size="icon"
            className="relative h-10 w-10 rounded-full transition-all duration-300 ease-in-out dark:bg-slate-900 dark:text-slate-100 dark:backdrop-blur-sm dark:ring-1 dark:ring-slate-800"
        >
          {/* Sun icon shown in light mode */}
          <Sun
              className="absolute top-1/2 left-1/2 h-[1.4rem] w-[1.4rem] -translate-x-1/2 -translate-y-1/2 rotate-0 scale-100 transition-all duration-300 ease-in-out dark:-rotate-90 dark:scale-0"
              style={{ color: 'var(--sun-color)' }}
          />
          {/* Moon icon shown in dark mode */}
          <Moon
              className="absolute top-1/2 left-1/2 h-[1.4rem] w-[1.4rem] -translate-x-1/2 -translate-y-1/2 rotate-90 scale-0 transition-all duration-300 ease-in-out dark:rotate-0 dark:scale-100"
              style={{ color: 'var(--moon-color)' }}
          />
          {/* Screen reader text */}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      {/* The content of the dropdown menu */}
      <DropdownMenuContent align="end">
        {/* Menu item to set the theme to light */}
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        {/* Menu item to set the theme to dark */}
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        {/* Menu item to set the theme based on system preference */}
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}