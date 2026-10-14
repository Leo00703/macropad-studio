using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Reflection.Emit;
using System.Text;

// Disassembler IL minimale: carica l'assembly in contesto ReflectionOnly (nessun codice dell'assembly viene eseguito).
public static class IlDump
{
    static Dictionary<short, OpCode> ops = new Dictionary<short, OpCode>();

    static IlDump()
    {
        foreach (FieldInfo f in typeof(OpCodes).GetFields(BindingFlags.Public | BindingFlags.Static))
        {
            OpCode oc = (OpCode)f.GetValue(null);
            ops[oc.Value] = oc;
        }
    }

    static string TypeName(Type t)
    {
        try { return t.FullName ?? t.Name; } catch { return "?"; }
    }

    static string Sig(MethodBase m)
    {
        StringBuilder sb = new StringBuilder();
        try
        {
            sb.Append(TypeName(m.DeclaringType)).Append("::").Append(m.Name).Append("(");
            ParameterInfo[] ps = m.GetParameters();
            for (int i = 0; i < ps.Length; i++)
            {
                if (i > 0) sb.Append(", ");
                sb.Append(TypeName(ps[i].ParameterType));
            }
            sb.Append(")");
        }
        catch (Exception ex) { sb.Append("<sig-err " + ex.Message + ">"); }
        return sb.ToString();
    }

    static string Operand(Module module, int token, Type[] tArgs, Type[] mArgs)
    {
        try
        {
            MemberInfo mi = module.ResolveMember(token, tArgs, mArgs);
            MethodBase mb = mi as MethodBase;
            if (mb != null)
            {
                string ret = "Void";
                MethodInfo minfo = mb as MethodInfo;
                if (minfo != null) ret = TypeName(minfo.ReturnType);
                return (mb.IsStatic ? "static" : "instance") + ";" + ret + ";" + Sig(mb);
            }
            FieldInfo fi = mi as FieldInfo;
            if (fi != null) return TypeName(fi.DeclaringType) + "::" + fi.Name;
            Type t = mi as Type;
            if (t != null) return TypeName(t);
            return mi.ToString();
        }
        catch (Exception ex)
        {
            return "<token 0x" + token.ToString("X8") + " " + ex.GetType().Name + ">";
        }
    }

    static void DumpBody(MethodBase m, StringBuilder sb)
    {
        MethodBody body;
        try { body = m.GetMethodBody(); } catch (Exception ex) { sb.AppendLine("    // body err: " + ex.Message); return; }
        if (body == null) { return; }
        Type[] tArgs = null, mArgs = null;
        try { if (m.DeclaringType.IsGenericType) tArgs = m.DeclaringType.GetGenericArguments(); } catch { }
        try { if (m.IsGenericMethod) mArgs = m.GetGenericArguments(); } catch { }

        foreach (LocalVariableInfo lv in body.LocalVariables)
            sb.AppendLine("    .local " + lv.LocalIndex + " : " + TypeName(lv.LocalType));

        byte[] il = body.GetILAsByteArray();
        Module module = m.Module;
        int i = 0;
        while (i < il.Length)
        {
            int start = i;
            OpCode oc;
            if (il[i] == 0xFE) { oc = ops[(short)(0xFE00 | il[i + 1])]; i += 2; }
            else { oc = ops[(short)il[i]]; i++; }
            string operand = "";
            switch (oc.OperandType)
            {
                case OperandType.InlineNone: break;
                case OperandType.ShortInlineBrTarget:
                    { int off = (sbyte)il[i]; i += 1; operand = "IL_" + (i + off).ToString("X4"); break; }
                case OperandType.InlineBrTarget:
                    { int off = BitConverter.ToInt32(il, i); i += 4; operand = "IL_" + (i + off).ToString("X4"); break; }
                case OperandType.ShortInlineI:
                    { operand = ((sbyte)il[i]).ToString(); i += 1; break; }
                case OperandType.ShortInlineVar:
                    { operand = il[i].ToString(); i += 1; break; }
                case OperandType.InlineVar:
                    { operand = BitConverter.ToUInt16(il, i).ToString(); i += 2; break; }
                case OperandType.InlineI:
                    { int v = BitConverter.ToInt32(il, i); i += 4; operand = v.ToString() + " (0x" + v.ToString("X") + ")"; break; }
                case OperandType.InlineI8:
                    { operand = BitConverter.ToInt64(il, i).ToString(); i += 8; break; }
                case OperandType.ShortInlineR:
                    { operand = BitConverter.ToSingle(il, i).ToString(); i += 4; break; }
                case OperandType.InlineR:
                    { operand = BitConverter.ToDouble(il, i).ToString(); i += 8; break; }
                case OperandType.InlineString:
                    {
                        int tok = BitConverter.ToInt32(il, i); i += 4;
                        string s;
                        try { s = module.ResolveString(tok); } catch { s = "<?>"; }
                        operand = "\"" + s.Replace("\r", "\\r").Replace("\n", "\\n") + "\"";
                        break;
                    }
                case OperandType.InlineMethod:
                case OperandType.InlineField:
                case OperandType.InlineType:
                case OperandType.InlineTok:
                    { int tok = BitConverter.ToInt32(il, i); i += 4; operand = Operand(module, tok, tArgs, mArgs); break; }
                case OperandType.InlineSig:
                    { operand = "sig 0x" + BitConverter.ToInt32(il, i).ToString("X8"); i += 4; break; }
                case OperandType.InlineSwitch:
                    {
                        int n = BitConverter.ToInt32(il, i); i += 4;
                        int baseOff = i + 4 * n;
                        List<string> tg = new List<string>();
                        for (int k = 0; k < n; k++) { tg.Add("IL_" + (baseOff + BitConverter.ToInt32(il, i)).ToString("X4")); i += 4; }
                        operand = "(" + string.Join(", ", tg.ToArray()) + ")";
                        break;
                    }
                default: operand = "<?>"; break;
            }
            sb.AppendLine("    IL_" + start.ToString("X4") + ": " + oc.Name + " " + operand);
        }
    }

    public static void Run(string exePath, string outPath)
    {
        string dir = Path.GetDirectoryName(exePath);
        AppDomain.CurrentDomain.ReflectionOnlyAssemblyResolve += delegate (object s, ResolveEventArgs e)
        {
            string name = new AssemblyName(e.Name).Name;
            string p = Path.Combine(dir, name + ".dll");
            if (File.Exists(p)) return Assembly.ReflectionOnlyLoadFrom(p);
            return Assembly.ReflectionOnlyLoad(e.Name);
        };

        Assembly asm = Assembly.ReflectionOnlyLoadFrom(exePath);
        StringBuilder sb = new StringBuilder();
        sb.AppendLine("// Assembly: " + asm.FullName);
        foreach (AssemblyName r in asm.GetReferencedAssemblies()) sb.AppendLine("// ref: " + r.FullName);
        foreach (string rn in asm.GetManifestResourceNames()) sb.AppendLine("// resource: " + rn);

        Type[] types;
        try { types = asm.GetTypes(); }
        catch (ReflectionTypeLoadException ex) { types = Array.FindAll(ex.Types, delegate (Type t) { return t != null; }); }

        BindingFlags all = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly;
        foreach (Type t in types)
        {
            sb.AppendLine();
            string baseName = "";
            try { baseName = t.BaseType != null ? TypeName(t.BaseType) : ""; } catch { }
            sb.AppendLine("=== TYPE " + TypeName(t) + " : " + baseName);
            foreach (FieldInfo f in t.GetFields(all))
            {
                string cv = "";
                try { if (f.IsLiteral) cv = " = " + f.GetRawConstantValue(); } catch { }
                sb.AppendLine("  FIELD " + (f.IsStatic ? "static " : "") + TypeName(f.FieldType) + " " + f.Name + cv);
            }
            foreach (ConstructorInfo c in t.GetConstructors(all))
            {
                sb.AppendLine("  CTOR " + Sig(c));
                DumpBody(c, sb);
            }
            foreach (MethodInfo m in t.GetMethods(all))
            {
                string extra = (m.Attributes & MethodAttributes.PinvokeImpl) != 0 ? " [PInvoke]" : "";
                sb.AppendLine("  METHOD " + TypeName(m.ReturnType) + " " + Sig(m) + extra);
                DumpBody(m, sb);
            }
        }
        File.WriteAllText(outPath, sb.ToString(), new UTF8Encoding(false));
    }
}
