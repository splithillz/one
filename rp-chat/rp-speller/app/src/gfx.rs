use std::cell::RefCell;
use std::collections::HashMap;

use windows::core::PCWSTR;
use windows::Win32::Foundation::{D2DERR_RECREATE_TARGET, RECT};
use windows::Win32::Graphics::Direct2D::Common::{
    D2D1_ALPHA_MODE_IGNORE, D2D1_ALPHA_MODE_PREMULTIPLIED, D2D1_COLOR_F, D2D1_GRADIENT_STOP, D2D1_PIXEL_FORMAT, D2D_RECT_F,
};
use windows::Win32::Graphics::Direct2D::{
    D2D1CreateFactory, ID2D1DCRenderTarget, ID2D1Factory, ID2D1SolidColorBrush, D2D1_ANTIALIAS_MODE_PER_PRIMITIVE, D2D1_DRAW_TEXT_OPTIONS_CLIP, D2D1_ELLIPSE,
    D2D1_EXTEND_MODE_CLAMP, D2D1_FACTORY_TYPE_SINGLE_THREADED, D2D1_FEATURE_LEVEL_DEFAULT, D2D1_GAMMA_2_2,
    D2D1_LINEAR_GRADIENT_BRUSH_PROPERTIES, D2D1_RENDER_TARGET_PROPERTIES, D2D1_RENDER_TARGET_TYPE_DEFAULT, D2D1_RENDER_TARGET_USAGE_NONE,
    D2D1_ROUNDED_RECT, D2D1_TEXT_ANTIALIAS_MODE_DEFAULT, D2D1_TEXT_ANTIALIAS_MODE_GRAYSCALE,
};
use windows::Win32::Graphics::DirectWrite::{
    DWriteCreateFactory, IDWriteFactory, IDWriteTextFormat, DWRITE_FACTORY_TYPE_SHARED, DWRITE_FONT_STRETCH_NORMAL, DWRITE_FONT_STYLE_NORMAL,
    DWRITE_FONT_WEIGHT, DWRITE_MEASURING_MODE_NATURAL, DWRITE_PARAGRAPH_ALIGNMENT_CENTER, DWRITE_TEXT_ALIGNMENT, DWRITE_TEXT_ALIGNMENT_CENTER,
    DWRITE_TEXT_ALIGNMENT_LEADING, DWRITE_TEXT_METRICS, DWRITE_TRIMMING, DWRITE_TRIMMING_GRANULARITY_CHARACTER,
    DWRITE_WORD_WRAPPING_NO_WRAP,
};
use windows::Win32::Graphics::Dxgi::Common::DXGI_FORMAT_B8G8R8A8_UNORM;
use windows::Win32::Graphics::Gdi::HDC;
use windows_numerics::{Matrix3x2, Vector2};

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rgba(pub f32, pub f32, pub f32, pub f32);

pub const fn hex(rgb: u32, a: f32) -> Rgba {
    Rgba(((rgb >> 16) & 0xFF) as f32 / 255.0, ((rgb >> 8) & 0xFF) as f32 / 255.0, (rgb & 0xFF) as f32 / 255.0, a)
}

impl Rgba {
    fn d2d(self) -> D2D1_COLOR_F {
        D2D1_COLOR_F { r: self.0, g: self.1, b: self.2, a: self.3 }
    }

    pub fn alpha(self, a: f32) -> Rgba {
        Rgba(self.0, self.1, self.2, a)
    }

    pub fn colorref(self) -> windows::Win32::Foundation::COLORREF {
        let c = |v: f32| (v.clamp(0.0, 1.0) * 255.0).round() as u32;
        windows::Win32::Foundation::COLORREF(c(self.0) | c(self.1) << 8 | c(self.2) << 16)
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub enum Align {
    Left,
    Center,
}

pub const NORMAL: u32 = 400;
pub const MEDIUM: u32 = 500;
pub const SEMIBOLD: u32 = 600;
pub const BOLD: u32 = 700;

struct Res {
    d2d: ID2D1Factory,
    dw: IDWriteFactory,
    family: Vec<u16>,
    formats: HashMap<(u32, u32, Align), IDWriteTextFormat>,
    opaque: Option<ID2D1DCRenderTarget>,
    alpha: Option<ID2D1DCRenderTarget>,
}

thread_local! {
    static RES: RefCell<Option<Res>> = const { RefCell::new(None) };
}

pub fn init(family: &str) -> bool {
    let made = unsafe {
        let d2d: windows::core::Result<ID2D1Factory> = D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, None);
        let dw: windows::core::Result<IDWriteFactory> = DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED);
        match (d2d, dw) {
            (Ok(d2d), Ok(dw)) => Some(Res {
                d2d,
                dw,
                family: family.encode_utf16().chain(Some(0)).collect(),
                formats: HashMap::new(),
                opaque: None,
                alpha: None,
            }),
            _ => None,
        }
    };
    let ok = made.is_some();
    RES.with(|r| *r.borrow_mut() = made);
    ok
}

pub fn shutdown() {
    let res = RES.with(|r| r.try_borrow_mut().ok().and_then(|mut g| g.take()));
    drop(res);
}

fn with_res<R>(f: impl FnOnce(&mut Res) -> R) -> Option<R> {
    RES.with(|r| r.try_borrow_mut().ok().and_then(|mut g| g.as_mut().map(f)))
}

fn format(res: &mut Res, size: f32, weight: u32, align: Align) -> Option<IDWriteTextFormat> {
    let key = ((size * 100.0) as u32, weight, align);
    if let Some(f) = res.formats.get(&key) {
        return Some(f.clone());
    }
    unsafe {
        let f = res
            .dw
            .CreateTextFormat(
                PCWSTR(res.family.as_ptr()),
                None,
                DWRITE_FONT_WEIGHT(weight as i32),
                DWRITE_FONT_STYLE_NORMAL,
                DWRITE_FONT_STRETCH_NORMAL,
                size,
                windows::core::w!("ru-ru"),
            )
            .ok()?;
        let _ = f.SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP);
        let _ = f.SetParagraphAlignment(DWRITE_PARAGRAPH_ALIGNMENT_CENTER);
        let a: DWRITE_TEXT_ALIGNMENT = match align {
            Align::Left => DWRITE_TEXT_ALIGNMENT_LEADING,
            Align::Center => DWRITE_TEXT_ALIGNMENT_CENTER,
        };
        let _ = f.SetTextAlignment(a);
        if let Ok(sign) = res.dw.CreateEllipsisTrimmingSign(&f) {
            let trimming = DWRITE_TRIMMING { granularity: DWRITE_TRIMMING_GRANULARITY_CHARACTER, delimiter: 0, delimiterCount: 0 };
            let _ = f.SetTrimming(&trimming, &sign);
        }
        res.formats.insert(key, f.clone());
        Some(f)
    }
}

pub fn measure(s: &str, size: f32, weight: u32) -> f32 {
    let units: Vec<u16> = s.encode_utf16().collect();
    with_res(|res| {
        let f = format(res, size, weight, Align::Left)?;
        unsafe {
            let layout = res.dw.CreateTextLayout(&units, &f, 100_000.0, 1000.0).ok()?;
            let mut m = DWRITE_TEXT_METRICS::default();
            layout.GetMetrics(&mut m).ok()?;
            Some(m.widthIncludingTrailingWhitespace)
        }
    })
    .flatten()
    .unwrap_or(s.chars().count() as f32 * size * 0.55)
}

pub struct Painter {
    rt: ID2D1DCRenderTarget,
    brush: ID2D1SolidColorBrush,
    alpha: bool,
}

fn rect(x: f32, y: f32, w: f32, h: f32) -> D2D_RECT_F {
    D2D_RECT_F { left: x, top: y, right: x + w, bottom: y + h }
}

impl Painter {
    pub fn begin(hdc: HDC, w: i32, h: i32, alpha: bool) -> Option<Painter> {
        let rt = with_res(|res| {
            let slot = if alpha { &mut res.alpha } else { &mut res.opaque };
            if slot.is_none() {
                let props = D2D1_RENDER_TARGET_PROPERTIES {
                    r#type: D2D1_RENDER_TARGET_TYPE_DEFAULT,
                    pixelFormat: D2D1_PIXEL_FORMAT {
                        format: DXGI_FORMAT_B8G8R8A8_UNORM,
                        alphaMode: if alpha { D2D1_ALPHA_MODE_PREMULTIPLIED } else { D2D1_ALPHA_MODE_IGNORE },
                    },
                    dpiX: 96.0,
                    dpiY: 96.0,
                    usage: D2D1_RENDER_TARGET_USAGE_NONE,
                    minLevel: D2D1_FEATURE_LEVEL_DEFAULT,
                };
                *slot = unsafe { res.d2d.CreateDCRenderTarget(&props).ok() };
            }
            slot.clone()
        })
        .flatten()?;
        unsafe {
            rt.BindDC(hdc, &RECT { left: 0, top: 0, right: w, bottom: h }).ok()?;
            rt.BeginDraw();
            rt.SetTransform(&Matrix3x2::identity());
            rt.SetTextAntialiasMode(if alpha { D2D1_TEXT_ANTIALIAS_MODE_GRAYSCALE } else { D2D1_TEXT_ANTIALIAS_MODE_DEFAULT });
            let brush = rt.CreateSolidColorBrush(&Rgba(1.0, 1.0, 1.0, 1.0).d2d(), None).ok()?;
            Some(Painter { rt, brush, alpha })
        }
    }

    pub fn end(self) -> bool {
        match unsafe { self.rt.EndDraw(None, None) } {
            Ok(()) => true,
            Err(e) => {
                if e.code() == D2DERR_RECREATE_TARGET {
                    let alpha = self.alpha;
                    with_res(|res| {
                        if alpha {
                            res.alpha = None
                        } else {
                            res.opaque = None
                        }
                    });
                }
                false
            }
        }
    }

    fn brush(&self, c: Rgba) -> &ID2D1SolidColorBrush {
        unsafe { self.brush.SetColor(&c.d2d()) };
        &self.brush
    }

    pub fn transform(&self, scale: f32, dx: f32, dy: f32) {
        let m = Matrix3x2 { M11: scale, M12: 0.0, M21: 0.0, M22: scale, M31: dx, M32: dy };
        unsafe { self.rt.SetTransform(&m) };
    }

    pub fn reset_transform(&self) {
        unsafe { self.rt.SetTransform(&Matrix3x2::identity()) };
    }

    pub fn clip(&self, x: f32, y: f32, w: f32, h: f32) {
        unsafe { self.rt.PushAxisAlignedClip(&rect(x, y, w, h), D2D1_ANTIALIAS_MODE_PER_PRIMITIVE) };
    }

    pub fn unclip(&self) {
        unsafe { self.rt.PopAxisAlignedClip() };
    }

    pub fn clear(&self, c: Rgba) {
        unsafe { self.rt.Clear(Some(&c.d2d())) };
    }

    pub fn fill(&self, x: f32, y: f32, w: f32, h: f32, c: Rgba) {
        unsafe { self.rt.FillRectangle(&rect(x, y, w, h), self.brush(c)) };
    }

    pub fn fill_round(&self, x: f32, y: f32, w: f32, h: f32, r: f32, c: Rgba) {
        let rr = D2D1_ROUNDED_RECT { rect: rect(x, y, w, h), radiusX: r, radiusY: r };
        unsafe { self.rt.FillRoundedRectangle(&rr, self.brush(c)) };
    }

    pub fn stroke_round(&self, x: f32, y: f32, w: f32, h: f32, r: f32, width: f32, c: Rgba) {
        let half = width / 2.0;
        let rr = D2D1_ROUNDED_RECT { rect: rect(x + half, y + half, w - width, h - width), radiusX: r, radiusY: r };
        unsafe { self.rt.DrawRoundedRectangle(&rr, self.brush(c), width, None) };
    }

    pub fn line(&self, x1: f32, y1: f32, x2: f32, y2: f32, width: f32, c: Rgba) {
        unsafe { self.rt.DrawLine(Vector2 { X: x1, Y: y1 }, Vector2 { X: x2, Y: y2 }, self.brush(c), width, None) };
    }

    pub fn dot(&self, cx: f32, cy: f32, r: f32, c: Rgba) {
        let e = D2D1_ELLIPSE { point: Vector2 { X: cx, Y: cy }, radiusX: r, radiusY: r };
        unsafe { self.rt.FillEllipse(&e, self.brush(c)) };
    }

    pub fn diamond(&self, cx: f32, cy: f32, size: f32, c: Rgba) {
        let half = size / 2.0;
        let rot = Matrix3x2::rotation_around(45.0, Vector2 { X: cx, Y: cy });
        let mut old = Matrix3x2::identity();
        unsafe {
            self.rt.GetTransform(&mut old);
            let m = mul(&rot, &old);
            self.rt.SetTransform(&m);
            self.rt.FillRectangle(&rect(cx - half, cy - half, size, size), self.brush(c));
            self.rt.SetTransform(&old);
        }
    }

    pub fn gradient(&self, x: f32, y: f32, w: f32, h: f32, top: Rgba, bottom: Rgba, r: f32) {
        unsafe {
            let stops = [D2D1_GRADIENT_STOP { position: 0.0, color: top.d2d() }, D2D1_GRADIENT_STOP { position: 1.0, color: bottom.d2d() }];
            let Ok(coll) = self.rt.CreateGradientStopCollection(&stops, D2D1_GAMMA_2_2, D2D1_EXTEND_MODE_CLAMP) else { return };
            let props = D2D1_LINEAR_GRADIENT_BRUSH_PROPERTIES { startPoint: Vector2 { X: x, Y: y }, endPoint: Vector2 { X: x, Y: y + h } };
            let Ok(b) = self.rt.CreateLinearGradientBrush(&props, None, &coll) else { return };
            let rr = D2D1_ROUNDED_RECT { rect: rect(x, y, w, h), radiusX: r, radiusY: r };
            self.rt.FillRoundedRectangle(&rr, &b);
        }
    }

    pub fn text(&self, s: &str, x: f32, y: f32, w: f32, h: f32, size: f32, weight: u32, c: Rgba, align: Align) {
        let units: Vec<u16> = s.encode_utf16().collect();
        let Some(f) = with_res(|res| format(res, size, weight, align)).flatten() else { return };
        unsafe {
            self.rt.DrawText(&units, &f, &rect(x, y, w, h), self.brush(c), D2D1_DRAW_TEXT_OPTIONS_CLIP, DWRITE_MEASURING_MODE_NATURAL);
        }
    }

    pub fn keycap(&self, label: &str, x: f32, cy: f32, size: f32, fg: Rgba, edge: Rgba, bg: Rgba) -> f32 {
        let pad = size * 0.55;
        let w = measure(label, size, SEMIBOLD) + pad * 2.0;
        let h = size + size * 0.8;
        let y = cy - h / 2.0;
        self.fill_round(x, y, w, h, size * 0.42, bg);
        self.stroke_round(x, y, w, h, size * 0.42, 1.0, edge);
        self.line(x + size * 0.3, y + h - 0.5, x + w - size * 0.3, y + h - 0.5, 1.0, edge);
        self.text(label, x, y, w, h - 1.0, size, SEMIBOLD, fg, Align::Center);
        w
    }

    pub fn keycap_width(label: &str, size: f32) -> f32 {
        measure(label, size, SEMIBOLD) + size * 1.1
    }
}

fn mul(a: &Matrix3x2, b: &Matrix3x2) -> Matrix3x2 {
    Matrix3x2 {
        M11: a.M11 * b.M11 + a.M12 * b.M21,
        M12: a.M11 * b.M12 + a.M12 * b.M22,
        M21: a.M21 * b.M11 + a.M22 * b.M21,
        M22: a.M21 * b.M12 + a.M22 * b.M22,
        M31: a.M31 * b.M11 + a.M32 * b.M21 + b.M31,
        M32: a.M31 * b.M12 + a.M32 * b.M22 + b.M32,
    }
}
