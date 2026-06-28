import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Pravila · Mundial '26" };

/* Static rules page — the pool's canonical Slovenian ruleset. */
export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pravila</h1>
        <p className="text-sm text-muted-foreground">
          Točkovanje napovedi. Lestvica se računa samodejno.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Napovedovanje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Napoveduje se <strong className="text-foreground">točen rezultat</strong>,
            ki ga je treba vpisati do začetka tekme. Pred tem ga je mogoče
            poljubno spreminjati.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Točkovanje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Točke se delijo za tri pravilne napovedi:</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>napoved zmagovalca</li>
            <li>točna napoved domačih zadetkov</li>
            <li>točna napoved gostujočih zadetkov</li>
          </ol>
          <p>
            Točki za domače ali gostujoče zadetke (2. in 3. točka) se upoštevata{" "}
            <strong className="text-foreground">le</strong>, če je pravilno
            napovedan tudi zmagovalec (1. točka).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Skupinski del <Badge variant="secondary">×1</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Za vsako napoved je možna ena točka,{" "}
            <strong className="text-foreground">skupno tri na tekmo</strong>.
          </p>
          <p>Če napoved ni vpisana pravočasno, se odšteje ena točka (−1).</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Izločilni boji <Badge variant="success">×2</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Od šestnajstine finala naprej se točkuje{" "}
            <strong className="text-foreground">dvojno</strong>, skupno šest na
            tekmo za pravilno napoved. Če napovedi ni, se odštejeta dve točki
            (−2).
          </p>
          <p>
            <strong className="text-foreground">
              Ni mogoče napovedati neodločenega rezultata
            </strong>{" "}
            — izbrati je treba zmagovalca. Napoveduje se rezultat po 90 ali 120
            minutah.
          </p>
          <p>
            Če je ob koncu podaljškov še vedno izenačeno in se izvajajo
            enajstmetrovke, se zmagovalni ekipi{" "}
            <strong className="text-foreground">prišteje en gol</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rezultati in lestvica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Rezultati tekem se vpisujejo samodejno, točke in lestvica pa se
            izračunavata sproti.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
