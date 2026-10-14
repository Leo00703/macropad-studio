using System;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

// Sola lettura: legge dal descrittore i metadati "value caps" (Report ID, dimensioni, usage). Non invia né legge report.
public static class HidValCaps
{
    [StructLayout(LayoutKind.Sequential)]
    struct HIDP_CAPS
    {
        public ushort Usage, UsagePage, InputReportByteLength, OutputReportByteLength, FeatureReportByteLength;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 17)] public ushort[] Reserved;
        public ushort NumberLinkCollectionNodes, NumberInputButtonCaps, NumberInputValueCaps, NumberInputDataIndices,
            NumberOutputButtonCaps, NumberOutputValueCaps, NumberOutputDataIndices,
            NumberFeatureButtonCaps, NumberFeatureValueCaps, NumberFeatureDataIndices;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr tmpl);
    [DllImport("hid.dll")] static extern bool HidD_GetPreparsedData(SafeFileHandle h, out IntPtr p);
    [DllImport("hid.dll")] static extern bool HidD_FreePreparsedData(IntPtr p);
    [DllImport("hid.dll")] static extern int HidP_GetCaps(IntPtr p, ref HIDP_CAPS c);
    [DllImport("hid.dll")] static extern int HidP_GetValueCaps(int type, byte[] caps, ref ushort len, IntPtr p);
    [DllImport("hid.dll")] static extern int HidP_GetButtonCaps(int type, byte[] caps, ref ushort len, IntPtr p);

    static void Dump(StringBuilder o, IntPtr pp, int type, string name, int n, bool buttons)
    {
        if (n == 0) return;
        ushort len = (ushort)n;
        byte[] buf = new byte[72 * n];
        int st = buttons ? HidP_GetButtonCaps(type, buf, ref len, pp) : HidP_GetValueCaps(type, buf, ref len, pp);
        if (st != 0x110000) { o.AppendLine("  " + name + ": failed 0x" + st.ToString("X")); return; }
        for (int i = 0; i < len; i++)
        {
            int b = i * 72;
            ushort up = BitConverter.ToUInt16(buf, b);
            byte rid = buf[b + 2];
            bool isRange = buf[b + 12] != 0;
            ushort umin = BitConverter.ToUInt16(buf, b + 56);
            ushort umax = BitConverter.ToUInt16(buf, b + 58);
            if (buttons)
            {
                o.AppendLine(string.Format("  {0}: ReportID={1} UsagePage=0x{2:X4} Usage={3}0x{4:X2}{5}",
                    name, rid, up, isRange ? "range " : "", umin, isRange ? ".." + "0x" + umax.ToString("X2") : ""));
            }
            else
            {
                ushort bits = BitConverter.ToUInt16(buf, b + 18);
                ushort cnt = BitConverter.ToUInt16(buf, b + 20);
                int lmin = BitConverter.ToInt32(buf, b + 40), lmax = BitConverter.ToInt32(buf, b + 44);
                o.AppendLine(string.Format("  {0}: ReportID={1} UsagePage=0x{2:X4} Usage={3}0x{4:X2} BitSize={5} ReportCount={6} Logical=[{7}..{8}]",
                    name, rid, up, isRange ? "range " : "", umin, bits, cnt, lmin, lmax));
            }
        }
    }

    public static string Describe(string instanceId)
    {
        string path = "\\\\?\\" + instanceId.Replace('\\', '#') + "#{4d1e55b2-f16f-11cf-88cb-001111000030}";
        SafeFileHandle h = CreateFile(path, 0, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
        if (h.IsInvalid) return "  open failed, win32 error " + Marshal.GetLastWin32Error();
        StringBuilder sb = new StringBuilder();
        using (h)
        {
            IntPtr pp;
            if (!HidD_GetPreparsedData(h, out pp)) return "  no preparsed data";
            HIDP_CAPS c = new HIDP_CAPS();
            c.Reserved = new ushort[17];
            if (HidP_GetCaps(pp, ref c) == 0x110000)
            {
                sb.AppendLine(string.Format("  UsagePage=0x{0:X4} Usage=0x{1:X4} In={2} Out={3} Feat={4}",
                    c.UsagePage, c.Usage, c.InputReportByteLength, c.OutputReportByteLength, c.FeatureReportByteLength));
                Dump(sb, pp, 0, "InputValue", c.NumberInputValueCaps, false);
                Dump(sb, pp, 1, "OutputValue", c.NumberOutputValueCaps, false);
                Dump(sb, pp, 0, "InputButton", c.NumberInputButtonCaps, true);
                Dump(sb, pp, 1, "OutputButton", c.NumberOutputButtonCaps, true);
            }
            HidD_FreePreparsedData(pp);
        }
        return sb.ToString();
    }
}
