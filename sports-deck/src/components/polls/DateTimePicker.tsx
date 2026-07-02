"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { ChevronDown } from "lucide-react"

type Props = {
  onChange?: (date?: Date, time?: string) => void
  initialDate?: Date
  initialTime?: string
}

export default function DateTimePicker({ onChange, initialDate, initialTime }: Props) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(initialDate)
  const [time, setTime] = React.useState<string>(initialTime ?? "10:30:00")

  React.useEffect(() => {
    onChange?.(date, time)
  }, [date, time, onChange])

  return (
    <FieldGroup className="max-w-xs flex-row">
      <Field>
        <FieldLabel htmlFor="date-picker-optional">Deadline Date</FieldLabel>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id="date-picker-optional"
              className="w-32 justify-between font-normal"
            >
              {date ? format(date, "PPP") : "Select date"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              defaultMonth={date}
              onSelect={(d) => {
                setDate(d)
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </Field>
      <Field className="w-32">
        <FieldLabel htmlFor="time-picker-optional">Time</FieldLabel>
        <Input
          type="time"
          id="time-picker-optional"
          step="1"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </Field>
    </FieldGroup>
  )
}
