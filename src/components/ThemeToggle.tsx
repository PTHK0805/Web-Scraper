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
        <Button variant="outline" size="icon">
          {/* Sun icon shown in light mode, hidden in dark mode */}
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          {/* Moon icon hidden in light mode, shown in dark mode */}
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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