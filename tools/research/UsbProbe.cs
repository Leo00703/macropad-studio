using System;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

// Sola lettura: interroga SOLO la porta del hub a cui e' collegato il dispositivo indicato.
// Esegue richieste di controllo standard GET_DESCRIPTOR (device, configuration, string, HID report).
public static class UsbProbe
{
    static readonly Guid GUID_DEVINTERFACE_USB_HUB = new Guid("f18a0e88-c30c-11d0-8815-00a0c906bed8");

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
    static extern int CM_Get_Device_Interface_List_Size(out uint len, ref Guid g, string devId, uint flags);
    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
    static extern int CM_Get_Device_Interface_List(ref Guid g, string devId, StringBuilder buf, uint len, uint flags);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr tmpl);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool DeviceIoControl(SafeFileHandle h, uint code, byte[] inBuf, int inLen, byte[] outBuf, int outLen, out int ret, IntPtr ov);

    const uint IOCTL_CONN_INFO_EX = 0x220448;
    const uint IOCTL_GET_DESC = 0x220410;

    static string Hex(byte[] b, int off, int len)
    {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < len; i++) sb.Append(b[off + i].ToString("X2")).Append(' ');
        return sb.ToString().Trim();
    }

    static byte[] GetDesc(SafeFileHandle h, uint port, byte bmReq, byte bReq, ushort wValue, ushort wIndex, ushort wLen)
    {
        byte[] buf = new byte[12 + wLen];
        BitConverter.GetBytes(port).CopyTo(buf, 0);
        buf[4] = bmReq; buf[5] = bReq;
        BitConverter.GetBytes(wValue).CopyTo(buf, 6);
        BitConverter.GetBytes(wIndex).CopyTo(buf, 8);
        BitConverter.GetBytes(wLen).CopyTo(buf, 10);
        int ret;
        if (!DeviceIoControl(h, IOCTL_GET_DESC, buf, buf.Length, buf, buf.Length, out ret, IntPtr.Zero)) return null;
        if (ret <= 12) return null;
        byte[] d = new byte[ret - 12];
        Array.Copy(buf, 12, d, 0, d.Length);
        return d;
    }

    static string Str(SafeFileHandle h, uint port, byte idx)
    {
        if (idx == 0) return "";
        byte[] d = GetDesc(h, port, 0x80, 6, (ushort)((3 << 8) | idx), 0x0409, 255);
        if (d == null || d.Length < 2) return "(n/a)";
        return Encoding.Unicode.GetString(d, 2, d.Length - 2);
    }

    public static string Run(string hubInstanceId, uint port)
    {
        StringBuilder o = new StringBuilder();
        Guid g = GUID_DEVINTERFACE_USB_HUB;
        uint len;
        if (CM_Get_Device_Interface_List_Size(out len, ref g, hubInstanceId, 0) != 0 || len < 2) return "no hub interface for " + hubInstanceId;
        StringBuilder list = new StringBuilder((int)len);
        CM_Get_Device_Interface_List(ref g, hubInstanceId, list, len, 0);
        string path = list.ToString().Split('\0')[0];
        SafeFileHandle h = CreateFile(path, 0xC0000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
        if (h.IsInvalid) return "cannot open hub, error " + Marshal.GetLastWin32Error();
        using (h)
        {
            byte[] ci = new byte[4096];
            BitConverter.GetBytes(port).CopyTo(ci, 0);
            int ret;
            if (!DeviceIoControl(h, IOCTL_CONN_INFO_EX, ci, ci.Length, ci, ci.Length, out ret, IntPtr.Zero))
                return "conn info failed, error " + Marshal.GetLastWin32Error();
            ushort vid = BitConverter.ToUInt16(ci, 12), pid = BitConverter.ToUInt16(ci, 14);
            o.AppendLine(string.Format("port {0}: VID={1:X4} PID={2:X4}", port, vid, pid));
            if (vid != 0x1189) return o + "  (non e' il dispositivo atteso: stop)";
            o.AppendLine("DEVICE_DESCRIPTOR: " + Hex(ci, 4, 18));
            o.AppendLine(string.Format("  bcdUSB={0:X4} class={1:X2}/{2:X2}/{3:X2} bMaxPacketSize0={4} bcdDevice={5:X4} numConfigs={6}",
                BitConverter.ToUInt16(ci, 6), ci[8], ci[9], ci[10], ci[11], BitConverter.ToUInt16(ci, 16), ci[21]));
            string[] speeds = { "Low (1.5M)", "Full (12M)", "High (480M)", "Super" };
            o.AppendLine("  speed=" + (ci[23] < 4 ? speeds[ci[23]] : ci[23].ToString()) + " currentConfig=" + ci[22]);
            o.AppendLine("  iManufacturer=" + ci[18] + " \"" + Str(h, port, ci[18]) + "\"  iProduct=" + ci[19] + " \"" + Str(h, port, ci[19]) +
                "\"  iSerial=" + ci[20] + " \"" + Str(h, port, ci[20]) + "\"");

            byte[] c9 = GetDesc(h, port, 0x80, 6, 0x0200, 0, 9);
            if (c9 == null) { o.AppendLine("config descriptor: n/a"); return o.ToString(); }
            ushort total = BitConverter.ToUInt16(c9, 2);
            byte[] cfg = GetDesc(h, port, 0x80, 6, 0x0200, 0, total);
            o.AppendLine("CONFIG_DESCRIPTOR (" + total + " bytes): " + Hex(cfg, 0, cfg.Length));
            o.AppendLine(string.Format("  bmAttributes=0x{0:X2} bMaxPower={1} (x2 mA = {2} mA)", cfg[7], cfg[8], cfg[8] * 2));

            // interfacce HID: leggi HID report descriptor
            int p = 0;
            int curIf = -1;
            while (p + 2 <= cfg.Length)
            {
                int bl = cfg[p], bt = cfg[p + 1];
                if (bl == 0) break;
                if (bt == 4) curIf = cfg[p + 2];
                if (bt == 0x21 && bl >= 9)
                {
                    ushort rl = BitConverter.ToUInt16(cfg, p + 7);
                    byte[] rd = GetDesc(h, port, 0x81, 6, 0x2200, (ushort)curIf, rl);
                    o.AppendLine("HID_REPORT_DESCRIPTOR if" + curIf + " (len " + rl + "): " + (rd == null ? "n/a" : Hex(rd, 0, rd.Length)));
                }
                p += bl;
            }
        }
        return o.ToString();
    }
}
