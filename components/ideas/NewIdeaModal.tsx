"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { X, MapPin, Check } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "../../lib/supabase/client";
import StreetAutocomplete from "../issues/StreetAutocomplete";
import Button from "../ui/Button";
import { toast } from "sonner";
import type { District } from "../../lib/types/database";

const LocationPickerModal = dynamic(
  () => import("../issues/LocationPickerModal"),
  { ssr: false },
);

const DISTRICTS = [
  "Center",
  "Varoš",
  "Trizla",
  "Točila",
  "Rid",
  "Tipski",
  "Boncejca",
  "KorzoMaalo",
  "MarinoMaalo",
  "Cacorica",
] as const;

const DISTRICT_MK: Record<District, string> = {
  Center: "Центар",
  Varoš: "Варош",
  Trizla: "Тризла",
  Točila: "Точила",
  Rid: "Рид",
  Tipski: "Типски",
  Boncejca: "Бончејца",
  KorzoMaalo: "Корзо Маало",
  MarinoMaalo: "Марино Маало",
  Cacorica: "Чачорица",
};

const schema = z.object({
  title: z.string().trim().min(1, "Внесете наслов"),
  body: z.string().optional(),
  street_name: z.string().optional(),
  district: z.enum(DISTRICTS).optional(),
});
type Fields = z.infer<typeof schema>;

interface Props {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewIdeaModal({ userId, onClose, onSuccess }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [streetNumber, setStreetNumber] = useState("");
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: { district: "Center" },
  });

  async function onSubmit(values: Fields) {
    const street = values.street_name?.trim() || null;
    const number = streetNumber.trim();
    const { error } = await supabase.from("ideas").insert({
      title: values.title.trim(),
      body: values.body?.trim() || null,
      street_name: street && number ? `${street} ${number}` : street,
      district: values.district ?? null,
      lat: pinLat,
      lng: pinLng,
      created_by: userId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Идејата е поднесена!");
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h2 className="text-sm font-semibold">Споделете идеја</h2>
          <button onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-700">
              Наслов *
            </label>
            <input
              {...register("title")}
              className="mt-1 w-full border border-zinc-200 rounded px-3 py-2 text-sm outline-none focus:border-black"
            />
            {errors.title && (
              <p className="text-[11px] text-red-500 mt-1">
                {errors.title.message}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700">Детали</label>
            <textarea
              {...register("body")}
              rows={4}
              className="mt-1 w-full border border-zinc-200 rounded px-3 py-2 text-sm outline-none focus:border-black resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700">
              Улица / локација
            </label>
            <div className="flex items-stretch gap-2 mt-1">
              <div className="flex-1 min-w-0">
                <Controller
                  name="street_name"
                  control={control}
                  render={({ field }) => (
                    <StreetAutocomplete
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="пр. Партизанска"
                      onSelect={(s) => {
                        if (s.district) {
                          setValue("district", s.district, {
                            shouldDirty: true,
                          });
                        }
                      }}
                    />
                  )}
                />
              </div>
              <input
                value={streetNumber}
                onChange={(e) =>
                  setStreetNumber(e.target.value.replace(/[^\d\w/]/g, ""))
                }
                placeholder="Бр."
                maxLength={8}
                className="w-14 shrink-0 border border-zinc-200 rounded px-2 text-sm text-center outline-none focus:border-black"
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <select
                {...register("district")}
                className="w-36 border border-zinc-200 rounded px-2.5 py-1.5 text-xs bg-white">
                <option value="">Населба</option>
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {DISTRICT_MK[d]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                  pinLat !== null && pinLng !== null
                    ? "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100"
                    : "border-zinc-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700"
                }`}>
                {pinLat !== null && pinLng !== null ? (
                  <>
                    <Check size={11} /> Локацијата е поставена
                  </>
                ) : (
                  <>
                    <MapPin size={11} /> Обележи на мапа
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Откажи
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Се испраќа…" : "Поднеси"}
            </Button>
          </div>
        </form>
      </div>

      {pickerOpen && (
        <LocationPickerModal
          initialLat={pinLat}
          initialLng={pinLng}
          onClose={() => setPickerOpen(false)}
          onConfirm={(lat, lng, streetOnly, matched, houseNumber) => {
            setPinLat(lat);
            setPinLng(lng);
            if (streetOnly) {
              setValue("street_name", streetOnly, { shouldDirty: true });
            }
            if (matched?.district) {
              setValue("district", matched.district, { shouldDirty: true });
            }
            if (houseNumber) {
              setStreetNumber(houseNumber);
            }
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
